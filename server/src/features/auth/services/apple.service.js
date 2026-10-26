const crypto = require("node:crypto");
const { getPrisma } = require("../../../core/db/prisma");
const { getConfig } = require("../../../config/env.config");
const { AppError } = require("../../../core/errors/AppError");
const { authConfig } = require("../config/auth.config");
const { logActivity } = require("./activity.service");
const { finishLogin, assertCanLogin } = require("./auth.service");
const { consumeNonce } = require("../../../core/auth/nonce");

const APPLE_ISSUER = "https://appleid.apple.com";
const APPLE_KEYS_URL = "https://appleid.apple.com/auth/keys";
const APPLE_KEYS_TTL_MS = 60 * 60 * 1000;

let cachedAppleKeys = null;
let appleKeysFetchedAt = 0;
let appleKeysFetchPromise = null;

function invalidAppleToken() {
  return AppError.unauthorized("Jeton Apple invalide ou expiré", "APPLE_TOKEN_INVALID");
}

async function getAppleKeys() {
  if (cachedAppleKeys && Date.now() - appleKeysFetchedAt < APPLE_KEYS_TTL_MS) {
    return cachedAppleKeys;
  }

  if (appleKeysFetchPromise) return appleKeysFetchPromise;

  appleKeysFetchPromise = (async () => {
    const response = await fetch(APPLE_KEYS_URL, {
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error("Unable to retrieve Apple public keys");
    }

    const body = await response.json();

    if (!Array.isArray(body.keys) || body.keys.length === 0) {
      throw new Error("Apple public keys response is invalid");
    }

    cachedAppleKeys = body.keys;
    appleKeysFetchedAt = Date.now();

    return cachedAppleKeys;
  })();

  try {
    return await appleKeysFetchPromise;
  } finally {
    appleKeysFetchPromise = null;
  }
}

function decodeJwtPart(value) {
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

async function verifyAppleIdToken(idToken, expectedNonce) {
  const clientIds = getConfig().apple.clientIds;

  if (clientIds.length === 0) {
    throw new AppError(503, "APPLE_NOT_CONFIGURED", "La connexion Apple n'est pas configurée");
  }

  let header;
  let payload;
  let signingInput;
  let signature;

  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT");

    [header, payload] = parts.slice(0, 2).map(decodeJwtPart);
    signingInput = `${parts[0]}.${parts[1]}`;
    signature = Buffer.from(parts[2], "base64url");

    if (
      header.alg !== "RS256" ||
      typeof header.kid !== "string" ||
      !header.kid ||
      !signature.length
    ) {
      throw new Error("Unsupported JWT header");
    }
  } catch {
    throw invalidAppleToken();
  }

  let keys;

  try {
    keys = await getAppleKeys();
  } catch {
    throw new AppError(
      503,
      "APPLE_KEYS_UNAVAILABLE",
      "La vérification Apple est temporairement indisponible",
    );
  }

  const jwk = keys.find((key) => key.kid === header.kid && key.kty === "RSA");

  if (!jwk) {
    cachedAppleKeys = null;
    appleKeysFetchedAt = 0;

    try {
      keys = await getAppleKeys();
    } catch {
      throw new AppError(
        503,
        "APPLE_KEYS_UNAVAILABLE",
        "La vérification Apple est temporairement indisponible",
      );
    }
  }

  const signingKey = keys.find((key) => key.kid === header.kid && key.kty === "RSA");

  if (!signingKey) throw invalidAppleToken();

  let signatureValid = false;

  try {
    const publicKey = crypto.createPublicKey({
      key: signingKey,
      format: "jwk",
    });

    signatureValid = crypto.verify("RSA-SHA256", Buffer.from(signingInput), publicKey, signature);
  } catch {
    throw invalidAppleToken();
  }

  if (!signatureValid) throw invalidAppleToken();

  const now = Math.floor(Date.now() / 1000);
  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

  if (
    payload.iss !== APPLE_ISSUER ||
    !audience.some((value) => clientIds.includes(value)) ||
    typeof payload.sub !== "string" ||
    !payload.sub ||
    !Number.isFinite(payload.exp) ||
    payload.exp <= now ||
    !Number.isFinite(payload.iat) ||
    payload.iat > now + 60 ||
    payload.iat > payload.exp
  ) {
    throw invalidAppleToken();
  }

  const tokenNonce = Buffer.from(typeof payload.nonce === "string" ? payload.nonce : "");
  const expectedNonceBuffer = Buffer.from(typeof expectedNonce === "string" ? expectedNonce : "");

  if (
    tokenNonce.length === 0 ||
    tokenNonce.length !== expectedNonceBuffer.length ||
    !crypto.timingSafeEqual(tokenNonce, expectedNonceBuffer)
  ) {
    throw AppError.unauthorized("Le nonce Apple est invalide", "APPLE_NONCE_INVALID");
  }

  await consumeNonce(expectedNonce, "APPLE_NONCE_INVALID");

  const emailVerified = payload.email_verified === true || payload.email_verified === "true";

  const email =
    typeof payload.email === "string" && payload.email.trim()
      ? payload.email.trim().toLowerCase()
      : null;

  if (email && !emailVerified) {
    throw AppError.unauthorized(
      "Apple n'a pas confirmé l'adresse e-mail",
      "APPLE_EMAIL_NOT_VERIFIED",
    );
  }

  return {
    providerAccountId: payload.sub,
    email: emailVerified ? email : null,
  };
}

async function findAppleAccount(providerAccountId) {
  return getPrisma().oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "APPLE",
        providerAccountId,
      },
    },
    include: {
      user: {
        include: {
          totp: {
            select: { confirmedAt: true },
          },
        },
      },
    },
  });
}

function clientMeta(meta) {
  return {
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  };
}

async function loginWithApple({ idToken, nonce, device }, meta) {
  const identity = await verifyAppleIdToken(idToken, nonce);
  const account = await findAppleAccount(identity.providerAccountId);

  if (!account) {
    throw AppError.notFound(
      "Aucun compte Apple SwiftGoma n'est associé à cette identité. Veuillez créer un compte.",
      "ACCOUNT_NOT_FOUND",
    );
  }

  assertCanLogin(account.user, { email: true });

  await getPrisma().oAuthAccount.update({
    where: { id: account.id },
    data: { lastUsedAt: new Date() },
  });

  return finishLogin({
    user: account.user,
    method: "APPLE",
    device,
    meta: clientMeta(meta),
  });
}

async function signupWithApple(
  { idToken, nonce, role, acceptTerms, confirmAge, name, device },
  meta,
) {
  if (acceptTerms !== true || confirmAge !== true) {
    throw AppError.badRequest(
      "L'acceptation des conditions et la confirmation d'âge sont obligatoires",
      undefined,
      "SIGNUP_CONFIRMATION_REQUIRED",
    );
  }

  if (!authConfig.selfSignupRoles.includes(role)) {
    throw AppError.forbidden(
      "Ce rôle ne peut pas être créé par inscription publique",
      "ROLE_NOT_ALLOWED",
    );
  }

  const identity = await verifyAppleIdToken(idToken, nonce);
  const prisma = getPrisma();

  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "APPLE",
        providerAccountId: identity.providerAccountId,
      },
    },
    select: { id: true },
  });

  if (linked) {
    throw AppError.conflict(
      "Ce compte Apple est déjà associé à SwiftGoma. Veuillez vous connecter.",
      "APPLE_ACCOUNT_ALREADY_REGISTERED",
    );
  }

  if (identity.email) {
    const existingUser = await prisma.user.findUnique({
      where: { email: identity.email },
      select: { id: true, status: true },
    });

    if (existingUser && existingUser.status !== "PENDING") {
      throw AppError.conflict(
        "Un compte existe déjà avec cette adresse. Connectez-vous à votre compte puis associez Apple.",
        "ACCOUNT_LINK_REQUIRED",
      );
    }
  }

  const now = new Date();
  let user;

  try {
    user = await prisma.$transaction(async (tx) => {
      const data = {
        name: name?.trim() || null,
        email: identity.email,
        emailVerifiedAt: identity.email ? now : null,
        role,
        status: "ACTIVE",
        termsVersion: authConfig.legal.termsVersion,
        privacyVersion: authConfig.legal.privacyVersion,
        termsAcceptedAt: now,
        ageConfirmedAt: now,
      };
      const created = pendingUserId
        ? await tx.user.update({ where: { id: pendingUserId }, data })
        : await tx.user.create({ data });

      await tx.oAuthAccount.create({
        data: {
          userId: created.id,
          provider: "APPLE",
          providerAccountId: identity.providerAccountId,
          email: identity.email,
          emailVerifiedAt: identity.email ? now : null,
        },
      });

      return tx.user.findUnique({
        where: { id: created.id },
        include: {
          totp: { select: { confirmedAt: true } },
        },
      });
    });
  } catch (err) {
    if (err?.code === "P2002") {
      throw AppError.conflict(
        "Cette identité Apple ou cette adresse e-mail est déjà enregistrée",
        "APPLE_ACCOUNT_ALREADY_REGISTERED",
      );
    }

    throw err;
  }

  await logActivity({
    userId: user.id,
    event: "SIGNUP_COMPLETED",
    method: "APPLE",
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    platform: device.platform,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { provider: "APPLE" },
  });

  return finishLogin({
    user,
    method: "APPLE",
    device,
    meta: clientMeta(meta),
  });
}

async function linkAppleAccount({ userId, idToken, nonce, stepUpCode }, meta) {
  const identity = await verifyAppleIdToken(idToken, nonce);
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") {
    throw AppError.forbidden(
      "Ce compte ne peut pas associer une nouvelle méthode de connexion",
      "ACCOUNT_NOT_ACTIVE",
    );
  }

  const existingIdentity = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "APPLE",
        providerAccountId: identity.providerAccountId,
      },
    },
    select: { userId: true },
  });

  if (existingIdentity) {
    if (existingIdentity.userId === userId) {
      return { linked: true, alreadyLinked: true };
    }

    throw AppError.conflict(
      "Ce compte Apple est déjà associé à un autre compte SwiftGoma",
      "APPLE_ACCOUNT_ALREADY_LINKED",
    );
  }

  const existingApple = await prisma.oAuthAccount.findFirst({
    where: { userId, provider: "APPLE" },
    select: { id: true },
  });

  if (existingApple) {
    throw AppError.conflict(
      "Un compte Apple est déjà associé à ce compte SwiftGoma",
      "APPLE_METHOD_ALREADY_LINKED",
    );
  }

  await consumeStepUp({ id: userId }, stepUpCode, meta, "oauth.link.apple");

  try {
    await prisma.oAuthAccount.create({
      data: {
        userId,
        provider: "APPLE",
        providerAccountId: identity.providerAccountId,
        email: identity.email,
        emailVerifiedAt: identity.email ? new Date() : null,
      },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      throw AppError.conflict(
        "Ce compte Apple vient d'être associé à un autre compte",
        "APPLE_ACCOUNT_ALREADY_LINKED",
      );
    }

    throw err;
  }

  await logActivity({
    userId,
    event: "OAUTH_ACCOUNT_LINKED",
    method: "APPLE",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { provider: "APPLE" },
  });

  await notifySecurityChange(userId, "LOGIN_METHOD_ADDED");

  return { linked: true, alreadyLinked: false };
}

module.exports = {
  loginWithApple,
  signupWithApple,
  linkAppleAccount,
};
