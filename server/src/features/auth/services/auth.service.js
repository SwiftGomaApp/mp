const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { issueOtp, verifyOtp, OTP_PURPOSES } = require("../../../core/auth/otp");
const {
  queueOtpEmail,
  queueOtpSms,
  queueWelcomeEmail,
  queueWelcomeSms,
  queueLoginAlertEmail,
  queueLoginAlertSms,
} = require("../../../core/queue/notifications");
const { authConfig } = require("../config/auth.config");
const { logActivity } = require("./activity.service");
const { createSession } = require("./session.service");
const { logger } = require("../../../core/logger/logger");
const { getConfig } = require("../../../config/env.config");
const { lookupIp } = require("../../../core/geo/geo");

const OTP_RESEND_MESSAGE = "Si un compte en attente existe, un nouveau code a été envoyé";
const UNKNOWN = "Inconnu";

const PLATFORM_LABELS = {
  ANDROID: "Appareil Android",
  IOS: "Appareil iOS",
  WEB: "Navigateur web",
};

function findLoginUser({ email, phone }) {
  const where = email
    ? { email, emailVerifiedAt: { not: null } }
    : { phone, phoneVerifiedAt: { not: null } };

  return getPrisma().user.findFirst({
    where,
    include: { totp: { select: { confirmedAt: true } } },
  });
}

function assertCanLogin(user, { email }) {
  if (!user || user.status === "PENDING" || user.status === "DELETED") {
    throw AppError.notFound(
      `Aucun compte n'est lié à ${email ? "cet e-mail" : "ce numéro"}, souhaitez-vous en créer un ?`,
      "ACCOUNT_NOT_FOUND",
    );
  }
  if (user.status === "SUSPENDED" || user.status === "BANNED") {
    throw AppError.forbidden(
      "Ce compte est suspendu, veuillez contacter le Support",
      "ACCOUNT_SUSPENDED",
    );
  }
  if (user.status === "PENDING_APPROVAL") {
    throw AppError.forbidden(
      "Ce compte est en attente d'approbation par un administrateur",
      "ACCOUNT_PENDING_APPROVAL",
    );
  }
}

function assertNoTwoFactorPending(user) {
  const required = authConfig.twoFactorRequiredRoles.includes(user.role);
  if (required || user.totp?.confirmedAt) {
    throw AppError.forbidden(
      "La double vérification est requise pour ce compte",
      "TWO_FACTOR_REQUIRED",
    );
  }
}

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
  const now = new Date();
  const identifier = identifierOf({ email, phone });
  const prisma = getPrisma();

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
  const isEmail = Boolean(email);
  const identifier = identifierOf({ email, phone });
  const prisma = getPrisma();

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

async function requestLoginOtp({ email, phone }, meta) {
  const user = await findLoginUser({ email, phone });
  assertCanLogin(user, { email });
  const prisma = getPrisma();

  const target = email ?? phone;
  const { code, expiresMinutes } = await issueOtp({ purpose: OTP_PURPOSES.LOGIN, target });

  if (email) await queueOtpEmail({ to: target, name: user.name, code, expiresMinutes });
  else await queueOtpSms({ to: target, code, expiresMinutes });

  await logActivity({
    userId: user.id,
    event: "OTP_REQUESTED",
    method: email ? "EMAIL_OTP" : "PHONE_OTP",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      purpose: OTP_PURPOSES.LOGIN,
    },
  });

  return {
    method: email ? "EMAIL" : "PHONE",
    target,
    expiresMinutes,
  };
}

async function notifyNewDevice({ user, device, now, geo }) {
  const deviceName = device.deviceName || PLATFORM_LABELS[device.platform];
  const location = geo.city || UNKNOWN;
  const country = geo.country || UNKNOWN;

  if (user.email && user.emailVerifiedAt) {
    await queueLoginAlertEmail({
      to: user.email,
      name: user.name,
      deviceName,
      location,
      country,
      date: now,
      activityUrl: getConfig().mail.activityUrl,
    });
  } else if (user.phone && user.phoneVerifiedAt) {
    await queueLoginAlertSms({ to: user.phone, deviceName, location: UNKNOWN });
  }
}

async function verifyLoginOtp({ email, phone, code, device }, meta) {
  const isEmail = Boolean(email);
  const method = isEmail ? "EMAIL_OTP" : "PHONE_OTP";
  const user = await findLoginUser({ email, phone });
  const prisma = getPrisma();
  const geo = await lookupIp(meta.ipAddress);

  try {
    await verifyOtp({
      purpose: OTP_PURPOSES.LOGIN,
      target: email ?? phone,
      code,
    });
  } catch (err) {
    if (user && err instanceof AppError) {
      await logActivity({
        userId: user.id,
        event: "LOGIN_FAILED",
        success: false,
        method,
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        platform: device.platform,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: { reason: err.code },
      });
    }
    throw err;
  }

  assertCanLogin(user, { email });
  assertNoTwoFactorPending(user);

  const knownDevice = await prisma.session.findFirst({
    where: { userId: user.id, deviceId: device.deviceId },
    select: { id: true },
  });
  const isNewDevice = !knownDevice;

  const now = new Date();
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });

  const tokens = await createSession({
    user,
    method,
    device,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  const activity = {
    userId: user.id,
    method,
    sessionId: tokens.session.id,
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    platform: device.platform,
    ipAddress: meta.ipAddress,
    city: geo.city,
    country: geo.country,
    userAgent: meta.userAgent,
  };

  await logActivity({ ...activity, event: "LOGIN_SUCCESS" });

  if (isNewDevice) {
    await logActivity({ ...activity, event: "NEW_DEVICE" });
    try {
      await notifyNewDevice({ user, device, now, geo });
    } catch (err) {
      logger.warn({ err, userId: user.id }, "Failed to queue new device alert");
    }
  }

  return {
    user: publicUser(user),
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    isNewDevice,
  };
}

async function getMe({ userId, sessionId }) {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
    include: { totp: { select: { confirmedAt: true } } },
  });

  if (!user || user.status === "DELETED") {
    throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_REVOKED");
  }

  if (user.status === "SUSPENDED" || user.status === "BANNED") {
    throw AppError.forbidden(
      "Ce compte est suspendu, veuillez contacter le Support",
      "ACCOUNT_SUSPENDED",
    );
  }

  if (user.status !== "ACTIVE") {
    throw AppError.forbidden("Ce compte n'est pas actif", "ACCOUNT_NOT_ACTIVE");
  }

  return {
    ...publicUser(user),
    emailVerified: Boolean(user.emailVerifiedAt),
    phoneVerified: Boolean(user.phoneVerifiedAt),
    hasPassword: Boolean(user.passwordHash),
    twoFactorEnabled: Boolean(user.totp?.confirmedAt),
    createdAt: user.createdAt,
    lastLoginAt: user.lastLoginAt,
    sessionId,
  };
}

module.exports = {
  startSignUp,
  verifySignUp,
  resendSignupOtp,
  requestLoginOtp,
  verifyLoginOtp,
  getMe,
};
