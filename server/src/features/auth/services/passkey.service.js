const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const {
  isoBase64URL,
  isoUint8Array,
  decodeCredentialPublicKey,
  cose,
  COSEALG,
} = require("@simplewebauthn/server/helpers");
const { getPrisma } = require("../../../core/db/prisma");
const { getRedis } = require("../../../core/cache/redis");
const { getConfig } = require("../../../config/env.config");
const { AppError } = require("../../../core/errors/AppError");
const { randomToken, sha256 } = require("../../../core/crypto/crypto");
const { authConfig } = require("../config/auth.config");
const { logActivity } = require("./activity.service");
const { assertCanLogin, finishLogin } = require("./auth.service");
const { consumeStepUp } = require("./stepUp.service");
const { notifySecurityChange } = require("./securityNotice.service");

const CHALLENGE_TTL_SECONDS = 5 * 60;

const registrationKey = (userId) => `passkey-reg:${userId}`;
const loginKey = (challengeId) => `passkey-login:${sha256(challengeId)}`;

function algorithmName(publicKey) {
  const alg = decodeCredentialPublicKey(publicKey).get(cose.COSEKEYS.alg);
  return COSEALG[alg] ?? String(alg);
}

function invalidPasskey() {
  return AppError.badRequest("Empreinte ou visage non reconnu", undefined, "PASSKEY_INVALID");
}

function expiredChallenge() {
  return AppError.badRequest(
    "La demande a expiré, veuillez réessayer",
    undefined,
    "PASSKEY_CHALLENGE_EXPIRED",
  );
}

const publicSelect = {
  id: true,
  name: true,
  deviceId: true,
  algorithm: true,
  createdAt: true,
  lastUsedAt: true,
};

async function listPasskeys(userId) {
  return getPrisma().passkey.findMany({
    where: { userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: publicSelect,
  });
}

async function beginRegistration({ userId }) {
  const prisma = getPrisma();
  const { rpId, rpName } = getConfig().passkey;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.unauthorized("Session expirée", "SESSION_REVOKED");

  const existing = await prisma.passkey.findMany({
    where: { userId, revokedAt: null },
    select: { credentialId: true },
  });
  if (existing.length >= authConfig.maxPasskeysPerUser) {
    throw AppError.conflict(
      "Vous avez atteint le nombre maximum d'empreintes ou de visages enregistrés",
      "PASSKEY_LIMIT_REACHED",
    );
  }

  const options = await generateRegistrationOptions({
    rpName,
    rpID: rpId,
    userName: user.email ?? user.phone ?? user.id,
    userDisplayName: user.name,
    userID: isoUint8Array.fromUTF8String(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.credentialId })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });

  await getRedis().set(registrationKey(userId), options.challenge, "EX", CHALLENGE_TTL_SECONDS);
  return options;
}

async function finishRegistration({ userId, response, name, deviceId, stepUpCode }, meta) {
  const prisma = getPrisma();
  const { rpId, origins } = getConfig().passkey;

  const expectedChallenge = await getRedis().getdel(registrationKey(userId));
  if (!expectedChallenge) throw expiredChallenge();

  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpId,
      requireUserVerification: true,
    });
  } catch {
    throw invalidPasskey();
  }
  if (!verification.verified) throw invalidPasskey();

  const { credential, credentialDeviceType, credentialBackedUp } = verification.registrationInfo;

  const duplicate = await prisma.passkey.findUnique({ where: { credentialId: credential.id } });
  if (duplicate) {
    throw AppError.conflict("Cette empreinte ou ce visage est déjà enregistré", "PASSKEY_EXISTS");
  }

  const count = await prisma.passkey.count({ where: { userId, revokedAt: null } });
  if (count >= authConfig.maxPasskeysPerUser) {
    throw AppError.conflict(
      "Vous avez atteint le nombre maximum d'empreintes ou de visages enregistrés",
      "PASSKEY_LIMIT_REACHED",
    );
  }

  await consumeStepUp({ id: userId }, stepUpCode, meta, "passkey.add");

  const passkey = await prisma.passkey.create({
    data: {
      userId,
      name: name ?? `Empreinte ou visage ${count + 1}`,
      credentialId: credential.id,
      publicKey: isoBase64URL.fromBuffer(credential.publicKey),
      algorithm: algorithmName(credential.publicKey),
      signCount: credential.counter,
      deviceId: deviceId ?? null,
    },
    select: publicSelect,
  });

  await logActivity({
    userId,
    event: "PASSKEY_ADDED",
    method: "PASSKEY",
    deviceId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: {
      passkeyId: passkey.id,
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp,
    },
  });

  await notifySecurityChange(userId, "LOGIN_METHOD_ADDED");

  return passkey;
}

async function renamePasskey({ userId, id, name }, meta) {
  const { count } = await getPrisma().passkey.updateMany({
    where: { id, userId, revokedAt: null },
    data: { name },
  });
  if (count !== 1) throw AppError.notFound("Empreinte ou visage introuvable", "PASSKEY_NOT_FOUND");

  await logActivity({
    userId,
    event: "PASSKEY_RENAMED",
    method: "PASSKEY",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { passkeyId: id },
  });
  return { id, name };
}

async function removePasskey({ userId, id }, meta) {
  const prisma = getPrisma();

  const passkey = await prisma.passkey.findFirst({ where: { id, userId, revokedAt: null } });
  if (!passkey) throw AppError.notFound("Empreinte ou visage introuvable", "PASSKEY_NOT_FOUND");

  const [user, otherPasskeys] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.passkey.count({ where: { userId, revokedAt: null, id: { not: id } } }),
  ]);
  const hasOtherMethod =
    Boolean(user.emailVerifiedAt) ||
    Boolean(user.phoneVerifiedAt) ||
    Boolean(user.passwordHash) ||
    otherPasskeys > 0;
  if (!hasOtherMethod) {
    throw AppError.forbidden(
      "Vous ne pouvez pas retirer votre dernière façon de vous connecter",
      "LAST_LOGIN_METHOD",
    );
  }

  await prisma.passkey.update({ where: { id }, data: { revokedAt: new Date() } });

  await logActivity({
    userId,
    event: "PASSKEY_REMOVED",
    method: "PASSKEY",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { passkeyId: id },
  });

  await notifySecurityChange(userId, "PASSKEY_REMOVED");
}

async function revokeAllPasskeys(userId) {
  const { count } = await getPrisma().passkey.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
}

// ---------------------------------- Login ----------------------------------

async function beginLogin() {
  const options = await generateAuthenticationOptions({
    rpID: getConfig().passkey.rpId,
    userVerification: "required",
    allowCredentials: [],
  });

  const challengeId = randomToken(32);
  await getRedis().set(loginKey(challengeId), options.challenge, "EX", CHALLENGE_TTL_SECONDS);

  return { challengeId, options };
}

async function verifyPasskeyLogin({ challengeId, response, device }, meta) {
  const prisma = getPrisma();
  const { rpId, origins } = getConfig().passkey;

  const expectedChallenge = await getRedis().getdel(loginKey(challengeId));
  if (!expectedChallenge) throw expiredChallenge();

  const passkey = await prisma.passkey.findFirst({
    where: { credentialId: response.id, revokedAt: null },
    include: { user: { include: { totp: { select: { confirmedAt: true } } } } },
  });
  if (!passkey) throw invalidPasskey();

  const { user } = passkey;
  const fail = async (reason) => {
    await logActivity({
      userId: user.id,
      event: "LOGIN_FAILED",
      success: false,
      method: "PASSKEY",
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: device.platform,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { reason },
    });
    throw invalidPasskey();
  };

  const userHandle = response.response?.userHandle;
  if (userHandle && isoBase64URL.toUTF8String(userHandle) !== user.id) {
    return fail("USER_HANDLE_MISMATCH");
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge,
      expectedOrigin: origins,
      expectedRPID: rpId,
      credential: {
        id: passkey.credentialId,
        publicKey: isoBase64URL.toBuffer(passkey.publicKey),
        counter: passkey.signCount,
      },
      requireUserVerification: true,
    });
  } catch {
    return fail("VERIFICATION_ERROR");
  }
  if (!verification.verified) return fail("NOT_VERIFIED");

  assertCanLogin(user, { email: user.email });

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { signCount: verification.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });

  const result = await finishLogin({ user, method: "PASSKEY", device, meta });
  return { ...result, platform: device.platform };
}

module.exports = {
  listPasskeys,
  beginRegistration,
  finishRegistration,
  renamePasskey,
  removePasskey,
  revokeAllPasskeys,
  beginLogin,
  verifyPasskeyLogin,
};
