const { getPrisma } = require("../../../core/db/prisma");
const { getRedis } = require("../../../core/cache/redis");
const { randomToken, sha256 } = require("../../../core/crypto/crypto");
const { AppError } = require("../../../core/errors/AppError");
const { issueOtp, verifyOtp, OTP_PURPOSES } = require("../../../core/auth/otp");
const {
  generateTotpSecret,
  verifyTotp,
  buildOtpauthUri,
  encryptSecret,
  decryptSecret,
} = require("../../../core/auth/totp");
const { generateBackupCodes, hashBackupCode } = require("../../../core/auth/backupCodes");
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
const MAX_FAILURES = 5;
const FAILURE_WINDOW_SECONDS = 15 * 60;
const CHALLENGE_TTL_SECONDS = 5 * 60;

const failKey = (userId) => `2fa-fail:${userId}`;
const challengeKey = (token) => `2fa-challenge:${sha256(token)}`;

async function assertAttemptsLeft(userId) {
  const count = Number(await getRedis().get(failKey(userId))) || 0;
  if (count >= MAX_FAILURES) {
    throw AppError.tooManyRequests(
      "Trop de codes incorrects, veuillez réessayer dans quelques minutes",
      "TWO_FACTOR_LOCKED",
    );
  }
}

async function recordFailure(userId) {
  const redis = getRedis();
  const count = await redis.incr(failKey(userId));
  if (count === 1) await redis.expire(failKey(userId), FAILURE_WINDOW_SECONDS);
}

async function clearFailures(userId) {
  await getRedis().del(failKey(userId));
}

async function getStatus(userId) {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, role: true },
  });

  if (!user) {
    throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_REVOKED");
  }

  const credential = await prisma.totpCredential.findUnique({
    where: { userId },
    select: { confirmedAt: true },
  });

  const enabled = Boolean(credential?.confirmedAt);
  const mandatory = authConfig.twoFactorRequiredRoles.includes(user.role);

  const backupCodesRemaining = enabled
    ? await prisma.backupCode.count({
        where: { userId, usedAt: null },
      })
    : 0;

  return {
    enabled,
    mandatory,
    backupCodesRemaining,
  };
}

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

function twoFactorState(user) {
  if (user.totp?.confirmedAt) return "CHALLENGE";

  if (authConfig.twoFactorRequiredRoles.includes(user.role)) {
    return "ENROLL";
  }

  return "NONE";
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

  const geo = await lookupIp(meta.ipAddress);

  const method = isEmail ? "EMAIL_OTP" : "PHONE_OTP";
  const tokens = await createSession({
    user,
    method,
    device,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    city: geo.city,
    country: geo.country,
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
    city: geo.city,
    country: geo.country,
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
  const location = geo.city || geo.country || UNKNOWN;

  if (user.email && user.emailVerifiedAt) {
    await queueLoginAlertEmail({
      to: user.email,
      name: user.name,
      deviceName,
      location,
      country: geo.country,
      date: now,
      activityUrl: getConfig().mail.activityUrl,
    });
  } else if (user.phone && user.phoneVerifiedAt) {
    await queueLoginAlertSms({ to: user.phone, deviceName, location });
  }
}

async function finishLogin({ user, method, device, meta }) {
  const state = twoFactorState(user);

  if (state === "ENROLL") {
    return {
      twoFactorRequired: true,
      enrollment: true,
      ...(await createLoginChallenge({ userId: user.id, method, device })),
    };
  }
  if (state === "CHALLENGE") {
    return {
      twoFactorRequired: true,
      ...(await createLoginChallenge({ userId: user.id, method, device })),
    };
  }
  return completeLogin({ user, method, device, meta });
}

async function verifyLoginOtp({ email, phone, code, device }, meta) {
  const isEmail = Boolean(email);
  const method = isEmail ? "EMAIL_OTP" : "PHONE_OTP";
  const user = await findLoginUser({ email, phone });

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

  // const state = twoFactorState(user);

  // if (state === "ENROLL") {
  //   throw AppError.forbidden(
  //     "La double vérification doit être activée pour ce compte",
  //     "TWO_FACTOR_ENROLLMENT_REQUIRED",
  //   );
  // }

  // if (state === "CHALLENGE") {
  //   return {
  //     twoFactorRequired: true,
  //     ...(await createLoginChallenge({ userId: user.id, method, device })),
  //   };
  // }

  // return completeLogin({ user, method, device, meta });

  return finishLogin({ user, method, device, meta });
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

async function beginSetup({ userId }) {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      totp: {
        select: { confirmedAt: true, secretEncrypted: true, updatedAt: true },
      },
    },
  });

  if (!user) throw AppError.unauthorized("Session expirée", "SESSION_REVOKED");
  if (user.totp?.confirmedAt) {
    throw AppError.conflict(
      "La double vérification est déjà activée",
      "TWO_FACTOR_ALREADY_ENABLED",
    );
  }

  const accountName = user.email ?? user.phone ?? user.id;
  const PENDING_SECRET_TTL_MS = 15 * 60 * 1000;

  if (user.totp && Date.now() - user.totp.updatedAt.getTime() < PENDING_SECRET_TTL_MS) {
    const secret = decryptSecret(user.totp.secretEncrypted);
    return { secret, otpauthUri: buildOtpauthUri({ secret, accountName }) };
  }

  const secret = generateTotpSecret();
  const data = { secretEncrypted: encryptSecret(secret), confirmedAt: null, lastUsedStep: null };

  await prisma.totpCredential.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  return { secret, otpauthUri: buildOtpauthUri({ secret, accountName }) };
}

async function replaceBackupCodes(tx, userId) {
  const codes = generateBackupCodes(authConfig.backupCodesCount);
  await tx.backupCode.deleteMany({ where: { userId } });
  await tx.backupCode.createMany({
    data: codes.map(({ hash }) => ({ userId, codeHash: hash })),
  });
  return codes.map(({ code }) => code);
}

async function confirmSetup({ userId, code }, meta) {
  const prisma = getPrisma();
  await assertAttemptsLeft(userId);

  const credential = await prisma.totpCredential.findUnique({
    where: { userId },
  });
  if (!credential) {
    throw AppError.badRequest(
      "Commencez par configurer la double vérification",
      undefined,
      "TWO_FACTOR_SETUP_REQUIRED",
    );
  }
  if (credential.confirmedAt) {
    throw AppError.conflict(
      "La double vérification est déjà activée",
      "TWO_FACTOR_ALREADY_ENABLED",
    );
  }

  const step = verifyTotp({
    secret: decryptSecret(credential.secretEncrypted),
    code,
  });

  if (step === null) {
    await recordFailure(userId);
    await logActivity({
      userId,
      event: "TOTP_FAILED",
      success: false,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { stage: "setup" },
    });
    throw AppError.badRequest("Code invalide", undefined, "TWO_FACTOR_INVALID");
  }

  const backupCodes = await prisma.$transaction(async (tx) => {
    await tx.totpCredential.update({
      where: { userId },
      data: { confirmedAt: new Date(), lastUsedStep: step },
    });
    return replaceBackupCodes(tx, userId);
  });

  await clearFailures(userId);
  const base = { userId, ipAddress: meta.ipAddress, userAgent: meta.userAgent };
  await logActivity({ ...base, event: "TOTP_ENABLED" });
  await logActivity({ ...base, event: "BACKUP_CODES_GENERATED" });

  return { backupCodes };
}

async function verifySecondFactor(userId, { code, backupCode }, meta) {
  const prisma = getPrisma();
  await assertAttemptsLeft(userId);

  const credential = await prisma.totpCredential.findUnique({
    where: { userId },
  });
  if (!credential?.confirmedAt) {
    throw AppError.badRequest(
      "La double vérification n'est pas activée",
      undefined,
      "TWO_FACTOR_NOT_ENABLED",
    );
  }

  const base = {
    userId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    ...(meta.device && {
      deviceId: meta.device.deviceId,
      deviceName: meta.device.deviceName,
      platform: meta.device.platform,
    }),
  };

  if (code) {
    const step = verifyTotp({
      secret: decryptSecret(credential.secretEncrypted),
      code,
      lastUsedStep: credential.lastUsedStep,
    });

    if (step !== null) {
      const { count } = await prisma.totpCredential.updateMany({
        where: { id: credential.id, OR: [{ lastUsedStep: null }, { lastUsedStep: { lt: step } }] },
        data: { lastUsedStep: step },
      });
      if (count === 1) {
        await clearFailures(userId);
        return { factor: "TOTP" };
      }
    }
  } else if (backupCode) {
    const { count } = await prisma.backupCode.updateMany({
      where: { userId, codeHash: hashBackupCode(backupCode), usedAt: null },
      data: { usedAt: new Date() },
    });
    if (count === 1) {
      await clearFailures(userId);
      await logActivity({ ...base, event: "BACKUP_CODE_USED" });
      return { factor: "BACKUP_CODE" };
    }
  }

  await recordFailure(userId);
  await logActivity({ ...base, event: "TOTP_FAILED", success: false });
  throw AppError.badRequest("Code invalide", undefined, "TWO_FACTOR_INVALID");
}

async function disable({ userId, role, code, backupCode }, meta) {
  if (authConfig.twoFactorRequiredRoles.includes(role)) {
    throw AppError.forbidden(
      "La double vérification est obligatoire pour ce compte",
      "TWO_FACTOR_MANDATORY",
    );
  }

  await verifySecondFactor(userId, { code, backupCode }, meta);

  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.totpCredential.delete({ where: { userId } }),
    prisma.backupCode.deleteMany({ where: { userId } }),
  ]);

  await logActivity({
    userId,
    event: "TOTP_DISABLED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
}

async function regenerateBackupCodes({ userId, code, backupCode }, meta) {
  await verifySecondFactor(userId, { code, backupCode }, meta);

  const backupCodes = await getPrisma().$transaction((tx) => replaceBackupCodes(tx, userId));

  await logActivity({
    userId,
    event: "BACKUP_CODES_GENERATED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { backupCodes };
}

async function createLoginChallenge({ userId, method, device }) {
  const token = randomToken(32);
  await getRedis().set(
    challengeKey(token),
    JSON.stringify({ userId, method, device }),
    "EX",
    CHALLENGE_TTL_SECONDS,
  );
  return { challengeToken: token, expiresIn: CHALLENGE_TTL_SECONDS };
}

async function peekLoginChallenge(token) {
  const raw = await getRedis().get(challengeKey(token));
  if (!raw) {
    throw AppError.unauthorized(
      "La vérification a expiré, veuillez vous reconnecter",
      "TWO_FACTOR_CHALLENGE_EXPIRED",
    );
  }
  return JSON.parse(raw);
}

async function consumeLoginChallenge(token) {
  const removed = await getRedis().del(challengeKey(token));
  if (removed !== 1) {
    throw AppError.unauthorized(
      "La vérification a expiré, veuillez vous reconnecter",
      "TWO_FACTOR_CHALLENGE_EXPIRED",
    );
  }
}

async function completeLogin({ user, method, device, meta }) {
  const prisma = getPrisma();

  const knownDevice = await prisma.session.findFirst({
    where: { userId: user.id, deviceId: device.deviceId },
    select: { id: true },
  });
  const isNewDevice = !knownDevice;

  const now = new Date();
  await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } });

  const geo = await lookupIp(meta.ipAddress);

  const tokens = await createSession({
    user,
    method,
    device,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    city: geo.city,
    country: geo.country,
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

async function verifyTwoFactorLogin({ challengeToken, code, backupCode }, meta) {
  const challenge = await peekLoginChallenge(challengeToken);

  const user = await getPrisma().user.findUnique({ where: { id: challenge.userId } });
  assertCanLogin(user, { email: user?.email });

  await verifySecondFactor(user.id, { code, backupCode }, { ...meta, device: challenge.device });
  await consumeLoginChallenge(challengeToken);

  const result = await completeLogin({
    user,
    method: challenge.method,
    device: challenge.device,
    meta,
  });
  return { ...result, platform: challenge.device.platform };
}

async function beginEnrollment({ challengeToken }) {
  const challenge = await peekLoginChallenge(challengeToken);
  const user = await getPrisma().user.findUnique({ where: { id: challenge.userId } });
  assertCanLogin(user, { email: user?.email });
  return beginSetup({ userId: user.id });
}

async function confirmEnrollment({ challengeToken, code }, meta) {
  const challenge = await peekLoginChallenge(challengeToken);
  const user = await getPrisma().user.findUnique({ where: { id: challenge.userId } });
  assertCanLogin(user, { email: user?.email });

  const { backupCodes } = await confirmSetup({ userId: user.id, code }, meta);
  await consumeLoginChallenge(challengeToken);

  const result = await completeLogin({
    user,
    method: challenge.method,
    device: challenge.device,
    meta,
  });
  return { ...result, backupCodes, platform: challenge.device.platform };
}

module.exports = {
  beginEnrollment,
  confirmEnrollment,
  startSignUp,
  verifySignUp,
  resendSignupOtp,
  requestLoginOtp,
  verifyLoginOtp,
  getMe,
  getStatus,
  beginSetup,
  confirmSetup,
  verifySecondFactor,
  disable,
  regenerateBackupCodes,
  createLoginChallenge,
  peekLoginChallenge,
  completeLogin,
  verifyTwoFactorLogin,
  consumeLoginChallenge,
  finishLogin,
  assertCanLogin,
};
