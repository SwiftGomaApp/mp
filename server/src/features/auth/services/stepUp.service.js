const { getPrisma } = require("../../../core/db/prisma");
const { getRedis } = require("../../../core/cache/redis");
const { AppError } = require("../../../core/errors/AppError");
const { issueOtp, verifyOtp, OTP_PURPOSES } = require("../../../core/auth/otp");
const { queueOtpEmail, queueOtpSms } = require("../../../core/queue/notifications");
const { logActivity } = require("./activity.service");

const STEP_UP_PURPOSE = `${OTP_PURPOSES.STEP_UP}:account`;
const targetKey = (userId) => `step-up-target:account:${userId}`;
const meta = (m) => ({ ipAddress: m?.ipAddress, userAgent: m?.userAgent });

async function loadActiveUser(userId) {
  const user = await getPrisma().user.findUnique({ where: { id: userId } });
  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_REVOKED");
  }
  return user;
}

function resolveContact(user, channel) {
  const email = user.email && user.emailVerifiedAt ? user.email : null;
  const phone = user.phone && user.phoneVerifiedAt ? user.phone : null;
  const wanted = channel ?? (email ? "EMAIL" : "PHONE");

  if (wanted === "EMAIL" && email) return { channel: "EMAIL", target: email };
  if (wanted === "PHONE" && phone) return { channel: "PHONE", target: phone };

  throw AppError.badRequest(
    "Aucun contact vérifié disponible pour recevoir le code",
    undefined,
    "CONTACT_NOT_AVAILABLE",
  );
}

async function requestStepUpOtp({ userId, channel }, m) {
  const user = await loadActiveUser(userId);
  const contact = resolveContact(user, channel);

  const { code, expiresMinutes } = await issueOtp({
    purpose: STEP_UP_PURPOSE,
    target: contact.target,
  });
  await getRedis().set(targetKey(userId), contact.target, "EX", expiresMinutes * 60);

  if (contact.channel === "EMAIL") {
    await queueOtpEmail({
      to: contact.target,
      name: user.name,
      code,
      expiresMinutes,
      purpose: OTP_PURPOSES.STEP_UP,
    });
  } else {
    await queueOtpSms({ to: contact.target, code, expiresMinutes });
  }

  await logActivity({
    userId,
    event: "OTP_REQUESTED",
    method: contact.channel === "EMAIL" ? "EMAIL_OTP" : "PHONE_OTP",
    ...meta(m),
    metadata: { purpose: OTP_PURPOSES.STEP_UP, action: "step-up" },
  });

  return { channel: contact.channel, target: contact.target, expiresMinutes };
}

async function consumeStepUp(user, code, m, action) {
  const totp = await getPrisma().totpCredential.findUnique({
    where: { userId: user.id },
    select: { confirmedAt: true },
  });

  if (totp?.confirmedAt) {
    const { verifySecondFactor } = require("./auth.service");
    await verifySecondFactor(user.id, { code }, m);
    await logActivity({
      userId: user.id,
      event: "STEP_UP_VERIFIED",
      ...meta(m),
      metadata: { action, factor: "TOTP" },
    });
    return;
  }

  const redis = getRedis();
  const target = await redis.get(targetKey(user.id));
  if (!target) throw AppError.badRequest("Code invalide ou expiré", undefined, "OTP_INVALID");

  try {
    await verifyOtp({ purpose: STEP_UP_PURPOSE, target, code });
  } catch (err) {
    if (err instanceof AppError) {
      await logActivity({
        userId: user.id,
        event: "OTP_FAILED",
        success: false,
        ...meta(m),
        metadata: { purpose: OTP_PURPOSES.STEP_UP, action, reason: err.code },
      });
    }
    throw err;
  }

  await redis.del(targetKey(user.id));
  await logActivity({
    userId: user.id,
    event: "STEP_UP_VERIFIED",
    ...meta(m),
    metadata: { action, factor: "OTP" },
  });
}

module.exports = { loadActiveUser, requestStepUpOtp, consumeStepUp };
