const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { issueOtp, verifyOtp, OTP_PURPOSES } = require("../../../core/auth/otp");
const {
  queueOtpEmail,
  queueOtpSms,
  queueWelcomeEmail,
  queueWelcomeSms,
} = require("../../../core/queue/notifications");
const { authConfig } = require("../config/auth.config");
const { logActivity } = require("./activity.service");
const { createSession } = require("./session.service");
const { logger } = require("../../../core/logger/logger");

const OTP_RESEND_MESSAGE = "Si un compte en attente existe, un nouveau code a été envoyé";

function publicUser(user) {
  const { id, name, email, phone, role, status } = user;
  return { id, name, email, phone, role, status };
}

function identifierOf({ email, phone }) {
  return email ? { email } : { phone };
}

async function sendSignupOtp(user) {
  const isEmail = Boolean(user.email);
  const target = isEmail ? user.email : user.phone;

  const { code, expiresMinutes } = await issueOtp({ purpose: OTP_PURPOSES.SIGNUP, target });

  if (isEmail) await queueOtpEmail({ to: target, name: user.name, code, expiresMinutes });
  else await queueOtpSms({ to: target, code, expiresMinutes });

  return { target, expiresMinutes };
}

async function startSignUp({ name, email, phone, role }, meta) {
  const prisma = getPrisma();
  const now = new Date();
  const identifier = identifierOf({ email, phone });

  const profile = {
    name,
    role,
    termsVersion: authConfig.legal.termsVersion,
    privacyVersion: authConfig.legal.privacyVersion,
    termsAcceptedAt: now,
    ageConfirmedAt: now,
  };

  const existing = await prisma.user.findUnique({ where: identifier });
  if (existing && existing.status !== "PENDING") {
    throw AppError.conflict(
      `Un compte existe déjà avec ${email ? "cet e-mail" : "ce numéro"}, veuillez vous connecter`,
      "ACCOUNT_EXISTS",
    );
  }

  const user = existing
    ? await prisma.user.update({ where: { id: existing.id }, data: profile })
    : await prisma.user.create({ data: { ...identifier, ...profile, status: "PENDING" } });

  const sent = await sendSignupOtp(user);

  await logActivity({
    userId: user.id,
    event: "SIGNUP_STARTED",
    method: email ? "EMAIL_OTP" : "PHONE_OTP",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return {
    method: email ? "EMAIL" : "PHONE",
    target: sent.target,
    expiresMinutes: sent.expiresMinutes,
  };
}

async function verifySignUp({ email, phone, code, device }, meta) {
  const prisma = getPrisma();
  const isEmail = Boolean(email);
  const identifier = identifierOf({ email, phone });

  await verifyOtp({
    purpose: OTP_PURPOSES.SIGNUP,
    target: email ?? phone,
    code,
  });

  const pending = await prisma.user.findUnique({ where: identifier });
  if (!pending || pending.status !== "PENDING") {
    throw AppError.badRequest("Code invalide ou expiré", undefined, "OTP_INVALID");
  }

  const now = new Date();
  const user = await prisma.user.update({
    where: { id: pending.id },
    data: {
      status: "ACTIVE",
      lastLoginAt: now,
      ...(isEmail ? { emailVerifiedAt: now } : { phoneVerifiedAt: now }),
    },
  });

  const method = isEmail ? "EMAIL_OTP" : "PHONE_OTP";
  const tokens = await createSession({
    user,
    method,
    device,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  await logActivity({
    userId: user.id,
    event: "SIGNUP_COMPLETED",
    method,
    sessionId: tokens.session.id,
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    platform: device.platform,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  try {
    if (isEmail) await queueWelcomeEmail({ to: user.email, name: user.name, role: user.role });
    else await queueWelcomeSms({ to: user.phone, name: user.name, role: user.role });
  } catch (err) {
    logger.warn({ err, userId: user.id }, "Failed to queue welcome message");
  }

  return {
    user: publicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  };
}

async function resendSignupOtp({ email, phone }) {
  const user = await getPrisma().user.findUnique({ where: identifierOf({ email, phone }) });
  if (user && user.status === "PENDING") await sendSignupOtp(user);
  return { message: OTP_RESEND_MESSAGE };
}

module.exports = { startSignUp, verifySignUp, resendSignupOtp };
