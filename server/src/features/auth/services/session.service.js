const { getPrisma } = require("../../../core/db/prisma");
const { signAccessToken, generateRefreshToken } = require("../../../core/auth/tokens");
const { markSessionRevoked } = require("../../../core/auth/revocation");
const { authConfig } = require("../config/auth.config");
const { logActivity } = require("./activity.service");

async function createSession({ user, method, device, ipAddress, userAgent }) {
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

module.exports = { createSession };
