const { getPrisma } = require("../../../core/db/prisma");
const {
  signAccessToken,
  generateRefreshToken,
  hashRefreshToken,
} = require("../../../core/auth/tokens");
const { getConfig, loadConfig } = require("../../../config/env.config");
const { AppError } = require("../../../core/errors/AppError");
const { markSessionRevoked } = require("../../../core/auth/revocation");
const { authConfig } = require("../config/auth.config");
const { logActivity } = require("./activity.service");

const ROTATION_GRACE_MS = 10 * 1000;

async function createSession({ user, method, device, ipAddress, userAgent, city, country }) {
  const prisma = getPrisma();
  const refresh = generateRefreshToken();
  const now = new Date();

  const { session, replacedIds, evictedIds } = await prisma.$transaction(async (tx) => {
    const active = await tx.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "asc" },
      select: { id: true, deviceId: true },
    });

    const replaced = active.filter((s) => s.deviceId === device.deviceId).map((s) => s.id);
    const others = active.filter((s) => s.deviceId !== device.deviceId);
    const overflow = others.length - (authConfig.maxDevicesPerUser - 1);
    const evicted = overflow > 0 ? others.slice(0, overflow).map((s) => s.id) : [];

    if (replaced.length) {
      await tx.session.updateMany({
        where: { id: { in: replaced } },
        data: { revokedAt: now, revokedReason: "REPLACED" },
      });
    }
    if (evicted.length) {
      await tx.session.updateMany({
        where: { id: { in: evicted } },
        data: { revokedAt: now, revokedReason: "EVICTED" },
      });
    }

    const created = await tx.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: refresh.hash,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        platform: device.platform,
        authMethod: method,
        userAgent,
        ipAddress,
        city,
        country,
        expiresAt: refresh.expiresAt,
      },
    });

    return { session: created, replacedIds: replaced, evictedIds: evicted };
  });

  await Promise.all([...replacedIds, ...evictedIds].map(markSessionRevoked));
  await Promise.all(
    evictedIds.map((sessionId) =>
      logActivity({ userId: user.id, event: "SESSION_EVICTED", sessionId, ipAddress, userAgent }),
    ),
  );

  return {
    session,
    accessToken: signAccessToken({ userId: user.id, role: user.role, sessionId: session.id }),
    refreshToken: refresh.token,
  };
}

async function revokeSession(session, reason) {
  await getPrisma().session.updateMany({
    where: {
      id: session.id,
      revokedAt: null,
    },
    data: {
      revokedAt: new Date(),
      revokedReason: reason,
      pushToken: null,
    },
  });
  await markSessionRevoked(session.id);
}

async function refreshSession(refreshToken, meta) {
  const prisma = getPrisma();
  const now = new Date();
  const hash = hashRefreshToken(refreshToken);

  const session = await prisma.session.findUnique({
    where: { refreshTokenHash: hash },
    include: { user: true },
  });

  if (!session) {
    const reused = await prisma.session.findUnique({
      where: { previousRefreshTokenHash: hash },
    });

    if (reused && !reused.revokedAt) {
      if (reused.rotatedAt && now - reused.rotatedAt < ROTATION_GRACE_MS) {
        throw AppError.conflict(
          "Renouvellement de session en cours, veuillez patienter",
          "REFRESH_IN_PROGRESS",
        );
      }

      await revokeSession(reused, "TOKEN_REUSE");
      await logActivity({
        userId: reused.userId,
        event: "TOKEN_REUSE_DETECTED",
        success: false,
        sessionId: reused.id,
        deviceId: reused.deviceId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw AppError.unauthorized("Session invalide, veuillez vous reconnecter", "TOKEN_REUSED");
    }
    throw AppError.unauthorized(
      "Session invalide, veuillez vous reconnecter",
      "REFRESH_TOKEN_INVALID",
    );
  }

  if (session.revokedAt) {
    throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_REVOKED");
  }
  if (session.expiresAt <= now) {
    throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_EXPIRED");
  }

  const { user } = session;
  if (user.status !== "ACTIVE") {
    await revokeSession(session, "USER_INACTIVE");
    if (user.status === "SUSPENDED" || user.status === "BANNED") {
      throw AppError.forbidden(
        "Ce compte est suspendu, veuillez contacter le Support",
        "ACCOUNT_SUSPENDED",
      );
    }
    throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_REVOKED");
  }

  const next = generateRefreshToken();
  const { count } = await prisma.session.updateMany({
    where: { id: session.id, refreshTokenHash: hash, revokedAt: null },
    data: {
      refreshTokenHash: next.hash,
      previousRefreshTokenHash: hash,
      rotatedAt: now,
      lastSeenAt: now,
      expiresAt: next.expiresAt,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    },
  });
  if (count !== 1) {
    throw AppError.conflict(
      "Renouvellement de session en cours, veuillex patienter",
      "REFRESH_IN_PROGRESS",
    );
  }

  return {
    accessToken: signAccessToken({ userId: user.id, role: user.role, sessionId: session.id }),
    refreshToken: next.token,
    expiresIn: getConfig().auth.accessTtlSeconds,
  };
}

async function revokeUserSessions(userId, { reason, exceptSessionId } = {}) {
  const prisma = getPrisma();

  const active = await prisma.session.findMany({
    where: {
      userId,
      revokedAt: null,
      expiresAt: { gt: new Date() },
      ...(exceptSessionId && { id: { not: exceptSessionId } }),
    },
    select: { id: true },
  });
  if (!active.length) return [];

  const ids = active.map((s) => s.id);
  await prisma.session.updateMany({
    where: { id: { in: ids }, revokedAt: null },
    data: { revokedAt: new Date(), revokedReason: reason, pushToken: null },
  });
  await Promise.all(ids.map(markSessionRevoked));

  return ids;
}

async function logout({ userId, sessionId }, meta) {
  const session = await getPrisma().session.findFirst({
    where: { id: sessionId, userId },
  });
  if (session && !session.revokedAt) await revokeSession(session, "LOGOUT");

  await logActivity({
    userId,
    event: "LOGOUT",
    sessionId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

async function logoutAll({ userId, sessionId }, meta) {
  const ids = await revokeUserSessions(userId, { reason: "LOGOUT_ALL" });

  await loadConfig({
    userId,
    event: "LOGOUT_ALL",
    sessionId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { revoked: ids.length },
  });

  return { revoked: ids.length };
}

async function listSessions({ userId, sessionId }) {
  const sessions = await getPrisma().session.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { lastSeenAt: "desc" },
    select: {
      id: true,
      deviceName: true,
      platform: true,
      city: true,
      country: true,
      ipAddress: true,
      createdAt: true,
      lastSeenAt: true,
    },
  });

  return sessions.map((s) => ({ ...s, current: s.id === sessionId }));
}

async function revokeOwnSession({ userId, sessionId }, targetId, meta) {
  const target = await getPrisma().session.findFirst({
    where: { id: targetId, userId, revokedAt: null },
  });
  if (!target) throw AppError.notFound("Appareil introuvable", "SESSION_NOT_FOUND");

  await revokeSession(target, "REVOKED_BY_USER");

  await logActivity({
    userId,
    event: "SESSION_REVOKED",
    sessionId: targetId,
    deviceId: target.deviceId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { byOwner: true },
  });

  return { revoked: true, current: targetId === sessionId };
}

module.exports = {
  createSession,
  refreshSession,
  revokeSession,
  revokeUserSessions,
  logout,
  logoutAll,
  listSessions,
  revokeOwnSession,
};
