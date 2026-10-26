const { getPrisma } = require("../../../core/db/prisma");
const { getRedis } = require("../../../core/cache/redis");
const { AppError } = require("../../../core/errors/AppError");
const { randomToken } = require("../../../core/crypto/crypto");
const { issueOtp, verifyOtp, OTP_PURPOSES } = require("../../../core/auth/otp");
const { hashPassword, verifyPassword, needsRehash } = require("../../../core/auth/password");
const { queueOtpEmail } = require("../../../core/queue/notifications");
const { logger } = require("../../../core/logger/logger");
const { logActivity } = require("./activity.service");
const { revokeUserSessions } = require("./session.service");
const { finishLogin, assertCanLogin } = require("./auth.service");
const { requestStepUpOtp, consumeStepUp, loadActiveUser } = require("./stepUp.service");
const { notifySecurityChange } = require("./securityNotice.service");

const MAX_FAILURES = 5;
const MAX_FAILURES_PER_EMAIL = 20;
const FAILURE_WINDOW_SECONDS = 15 * 60;
const FORGOT_MESSAGE =
  "Si un compte existe pour cet e-mail, un code de réinitialisation a été envoyé";

const loginFailKey = (email) => `pw-fail:login:${email}`;
const loginIpFailKey = (email, ip) => `pw-fail:login-ip:${email}:${ip ?? "unknown"}`;
const userFailKey = (userId) => `pw-fail:user:${userId}`;

let dummyHash;

async function getDummyHash() {
  dummyHash ??= await hashPassword(randomToken(16));
  return dummyHash;
}

async function assertNotLocked(key, max = MAX_FAILURES) {
  const count = Number(await getRedis().get(key)) || 0;
  if (count >= max) {
    throw AppError.tooManyRequests(
      "Trop de tentatives, veuillez réessayer dans quelques minutes",
      "PASSWORD_LOCKED",
    );
  }
}

async function recordFailure(key) {
  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, FAILURE_WINDOW_SECONDS);
  return count;
}

const clearFailures = (key) => getRedis().del(key);

function meta(m, extra = {}) {
  return { ipAddress: m.ipAddress, userAgent: m.userAgent, ...extra };
}

async function createPassword({ userId, password, code }, m) {
  const user = await loadActiveUser(userId);
  if (user.passwordHash) {
    throw AppError.conflict(
      "Un mot de passe existe déjà, utilisez la modification du mot de passe",
      "PASSWORD_ALREADY_SET",
    );
  }

  await consumeStepUp(user, code, m, "password.create");

  const passwordHash = await hashPassword(password);
  const { count } = await getPrisma().user.updateMany({
    where: { id: userId, passwordHash: null },
    data: { passwordHash },
  });

  if (count !== 1) {
    throw AppError.conflict("Un mot de passe existe déjà", "PASSWORD_ALREADY_SET");
  }

  await logActivity({ userId, event: "PASSWORD_SET", method: "PASSWORD", ...meta(m) });
  await notifySecurityChange(user, "PASSWORD_SET");
}

async function updatePassword({ userId, sessionId, currentPassword, newPassword, code }, m) {
  const user = await loadActiveUser(userId);
  if (!user.passwordHash) {
    throw AppError.conflict(
      "Aucun mot de passe n'est défini, veuillez en créer un",
      "PASSWORD_NOT_SET",
    );
  }

  await assertNotLocked(userFailKey(userId));
  if (!(await verifyPassword(currentPassword, user.passwordHash))) {
    await recordFailure(userFailKey(userId));
    throw new AppError(400, "INVALID_CURRENT_PASSWORD", "Le mot de passe actuel est incorrect");
  }

  await clearFailures(userFailKey(userId));

  if (await verifyPassword(newPassword, user.passwordHash)) {
    throw AppError.badRequest(
      "Le nouveau mot de passe doit être différent de l'actuel",
      undefined,
      "PASSWORD_UNCHANGED",
    );
  }

  await consumeStepUp(user, code, m, "password.update");

  await getPrisma().user.update({
    where: { id: userId },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await revokeUserSessions(userId, { reason: "PASSWORD_CHANGED", exceptSessionId: sessionId });

  await logActivity({
    userId,
    event: "PASSWORD_CHANGED",
    method: "PASSWORD",
    sessionId,
    ...meta(m),
  });
  await notifySecurityChange(user, "PASSWORD_CHANGED");
}

async function forgotPassword({ email }, m) {
  const user = await getPrisma().user.findFirst({
    where: { email, emailVerifiedAt: { not: null } },
  });

  if (!user || user.status !== "ACTIVE") return { message: FORGOT_MESSAGE };

  try {
    const { code, expiresMinutes } = await issueOtp({
      purpose: OTP_PURPOSES.PASSWORD_RESET,
      target: email,
    });
    await queueOtpEmail({ to: email, name: user.name, code, expiresMinutes });
  } catch (err) {
    if (!(err instanceof AppError && ["OTP_COOLDOWN", "OTP_HOURLY_LIMIT"].includes(err.code))) {
      throw err;
    }
    return { message: FORGOT_MESSAGE };
  }

  await logActivity({
    userId: user.id,
    event: "PASSWORD_RESET_REQUESTED",
    method: "EMAIL_OTP",
    ...meta(m),
  });

  return { message: FORGOT_MESSAGE };
}

async function resetPassword({ email, code, newPassword }, m) {
  await verifyOtp({ purpose: OTP_PURPOSES.PASSWORD_RESET, target: email, code });

  const user = await getPrisma().user.findFirst({
    where: { email, emailVerifiedAt: { not: null } },
  });
  if (!user || user.status !== "ACTIVE") {
    throw AppError.badRequest("Code invalide ou expiré", undefined, "OTP_INVALID");
  }

  await getPrisma().user.update({
    where: { id: user.id },
    data: { passwordHash: await hashPassword(newPassword) },
  });
  await revokeUserSessions(user.id, { reason: "PASSWORD_RESET" });
  await Promise.all([clearFailures(loginFailKey(email)), clearFailures(userFailKey(user.id))]);

  await logActivity({
    userId: user.id,
    event: "PASSWORD_RESET_COMPLETED",
    method: "EMAIL_OTP",
    ...meta(m),
  });
  await notifySecurityChange(user, "PASSWORD_RESET");
}

async function loginWithPassword({ email, password, device }, m) {
  const ipKey = loginIpFailKey(email, m.ipAddress);
  await assertNotLocked(ipKey, MAX_FAILURES);
  await assertNotLocked(loginFailKey(email), MAX_FAILURES_PER_EMAIL);

  const user = await getPrisma().user.findFirst({
    where: { email, emailVerifiedAt: { not: null } },
    include: { totp: { select: { confirmedAt: true } } },
  });

  const matches = await verifyPassword(password, user?.passwordHash ?? (await getDummyHash()));

  if (!user?.passwordHash || !matches) {
    const [failures] = await Promise.all([
      recordFailure(ipKey),
      recordFailure(loginFailKey(email)),
    ]);
    if (user) {
      const base = {
        userId: user.id,
        success: false,
        method: "PASSWORD",
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        platform: device.platform,
        ...meta(m),
      };
      await logActivity({
        ...base,
        event: "LOGIN_FAILED",
        metadata: { reason: "INVALID_CREDENTIALS" },
      });
      if (failures === MAX_FAILURES) await logActivity({ ...base, event: "ACCOUNT_LOCKED" });
    }
    throw new AppError(401, "INVALID_CREDENTIALS", "E-mail ou mot de passe incorrect");
  }

  assertCanLogin(user, { email });
  await Promise.all([clearFailures(ipKey), clearFailures(loginFailKey(email))]);

  if (needsRehash(user.passwordHash)) {
    await getPrisma()
      .user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(password) },
      })
      .catch((err) => logger.warn({ err, userId: user.id }, "Password rehash failed"));
  }

  return finishLogin({ user, method: "PASSWORD", device, meta: m });
}

async function removePassword({ userId, code }, m) {
  const user = await loadActiveUser(userId);
  if (!user.passwordHash) {
    throw AppError.conflict("Aucun mot de passe n'est défini", "PASSWORD_NOT_SET");
  }

  const passkeys = await getPrisma().passkey.count({ where: { userId, revokedAt: null } });
  const hasOtherMethod =
    Boolean(user.emailVerifiedAt) || Boolean(user.phoneVerifiedAt) || passkeys > 0;
  if (!hasOtherMethod) {
    throw AppError.forbidden(
      "Vous ne pouvez pas retirer votre dernière façon de vous connecter",
      "LAST_LOGIN_METHOD",
    );
  }

  await consumeStepUp(user, code, m, "password.remove");

  await getPrisma().user.update({ where: { id: userId }, data: { passwordHash: null } });

  await logActivity({ userId, event: "PASSWORD_REMOVED", method: "PASSWORD", ...meta(m) });
  await notifySecurityChange(user, "PASSWORD_REMOVED");
}

module.exports = {
  requestStepUpOtp,
  createPassword,
  updatePassword,
  forgotPassword,
  resetPassword,
  loginWithPassword,
  removePassword,
};
