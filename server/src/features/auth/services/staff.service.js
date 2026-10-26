const { getPrisma } = require("../../../core/db/prisma");
const { getRedis } = require("../../../core/cache/redis");
const { AppError } = require("../../../core/errors/AppError");
const { randomToken, sha256 } = require("../../../core/crypto/crypto");
const { hashPassword } = require("../../../core/auth/password");
const { getConfig } = require("../../../config/env.config");
const { queueStaffSetupEmail } = require("../../../core/queue/notifications");
const { authConfig } = require("../config/auth.config");
const { logActivity } = require("./activity.service");
const { consumeStepUp, loadActiveUser } = require("./stepUp.service");
const { notifySecurityChange } = require("./securityNotice.service");
const { revokeUserSessions } = require("./session.service");

const HOUR = 60 * 60 * 1000;

const setupKey = (token) => `staff-setup:${sha256(token)}`;
const latestSetupKey = (userId) => `staff-setup-latest:${userId}`;

function invalidSetup() {
  return AppError.badRequest("Ce lien est invalide ou a expiré", undefined, "STAFF_SETUP_INVALID");
}

async function issueSetupLink(user) {
  const { staffSetupTtlMs } = authConfig;
  const redis = getRedis();
  const token = randomToken(32);
  const key = setupKey(token);
  const ttlSeconds = Math.floor(staffSetupTtlMs / 1000);

  const previous = await redis.get(latestSetupKey(user.id));
  if (previous) await redis.del(previous);

  await redis
    .multi()
    .set(key, user.id, "EX", ttlSeconds)
    .set(latestSetupKey(user.id), key, "EX", ttlSeconds)
    .exec();

  const url = new URL(getConfig().mail.staffSetupUrl);
  url.searchParams.set("token", token);

  await queueStaffSetupEmail({
    to: user.email,
    name: user.name,
    email: user.email,
    setupUrl: url.toString(),
    expiresHours: Math.round(staffSetupTtlMs / HOUR),
  });
}

async function requireAdmin(actorId, code, meta, action) {
  const actor = await loadActiveUser(actorId);
  if (actor.role !== "ADMIN") throw AppError.forbidden();
  await consumeStepUp(actor, code, meta, action);
}

async function loadSupportAccount(userId) {
  const user = await getPrisma().user.findUnique({ where: { id: userId } });
  if (!user || user.role !== "SUPPORT" || user.status === "DELETED") {
    throw AppError.notFound("Compte introuvable", "ACCOUNT_NOT_FOUND");
  }
  return user;
}

async function createSupportAccount({ actorId, name, email, code }, meta) {
  const prisma = getPrisma();

  await requireAdmin(actorId, code, meta, "staff.create");

  const taken = await prisma.user.findFirst({
    where: { OR: [{ email }, { secondaryEmail: email }] },
    select: { id: true },
  });
  if (taken) {
    throw AppError.conflict("Un compte existe déjà avec cet e-mail", "ACCOUNT_EXISTS");
  }

  let user;
  try {
    user = await prisma.user.create({
      data: {
        name,
        email,
        emailVerifiedAt: new Date(),
        role: "SUPPORT",
        status: "ACTIVE",
      },
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw AppError.conflict("Un compte existe déjà avec cet e-mail", "ACCOUNT_EXISTS");
    }
    throw err;
  }

  try {
    await issueSetupLink(user);
  } catch (err) {
    await prisma.user.delete({ where: { id: user.id } }).catch(() => {});
    throw err;
  }

  await logActivity({
    userId: user.id,
    event: "STAFF_ACCOUNT_CREATED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { actorId, role: user.role },
  });

  const { id, role, status } = user;
  return { id, name, email, role, status };
}

async function completeStaffSetup({ token, newPassword }, meta) {
  const userId = await getRedis().getdel(setupKey(token));
  if (!userId) throw invalidSetup();

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (
    !user ||
    !authConfig.staffRoles.includes(user.role) ||
    user.status !== "ACTIVE" ||
    user.passwordHash
  ) {
    throw invalidSetup();
  }

  const { count } = await prisma.user.updateMany({
    where: { id: userId, passwordHash: null },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  if (count !== 1) throw invalidSetup();

  await logActivity({
    userId,
    event: "PASSWORD_SET",
    method: "PASSWORD",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { via: "staff-setup" },
  });
  await notifySecurityChange(user, "PASSWORD_SET");
}

async function resendStaffSetup({ actorId, userId, code }, meta) {
  await requireAdmin(actorId, code, meta, "staff.resend-setup");

  const user = await loadSupportAccount(userId);
  if (user.status !== "ACTIVE" || user.passwordHash) {
    throw AppError.conflict("Ce compte a déjà un mot de passe", "STAFF_SETUP_NOT_PENDING");
  }

  await issueSetupLink(user);

  await logActivity({
    userId: user.id,
    event: "STAFF_SETUP_RESENT",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { actorId },
  });
}

async function resetStaffTwoFactor({ actorId, userId, code, reason }, meta) {
  await requireAdmin(actorId, code, meta, "staff.reset-2fa");

  const prisma = getPrisma();
  const user = await loadSupportAccount(userId);

  const credential = await prisma.totpCredential.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!credential) {
    throw AppError.conflict("La double vérification n'est pas activée", "TWO_FACTOR_NOT_ENABLED");
  }

  await prisma.$transaction([
    prisma.totpCredential.delete({ where: { userId } }),
    prisma.backupCode.deleteMany({ where: { userId } }),
  ]);
  await revokeUserSessions(userId, { reason: "TWO_FACTOR_RESET" });

  await logActivity({
    userId,
    event: "TOTP_DISABLED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { actorId, via: "admin-reset", reason },
  });
  await notifySecurityChange(user, "TWO_FACTOR_DISABLED");
}

module.exports = {
  createSupportAccount,
  completeStaffSetup,
  resendStaffSetup,
  resetStaffTwoFactor,
};
