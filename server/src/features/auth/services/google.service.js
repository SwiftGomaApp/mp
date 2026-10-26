const { OAuth2Client } = require("google-auth-library");
const { getPrisma } = require("../../../core/db/prisma");
const { getConfig } = require("../../../config/env.config");
const { AppError } = require("../../../core/errors/AppError");
const { authConfig } = require("../config/auth.config");
const { logActivity } = require("./activity.service");
const { finishLogin, assertCanLogin } = require("./auth.service");
const { consumeStepUp } = require("./stepUp.service");
const { notifySecurityChange } = require("./securityNotice.service");
const { consumeNonce } = require("../../../core/auth/nonce");

const googleClient = new OAuth2Client();

async function verifyGoogleIdToken(idToken) {
  const clientIds = getConfig().google.clientIds;

  if (!clientIds.length) {
    throw new AppError(503, "GOOGLE_NOT_CONFIGURED", "La connexion Google n'est pas configurée");
  }

  let ticket;

  try {
    ticket = await googleClient.verifyIdToken({
      idToken,
      audience: clientIds,
    });
  } catch {
    throw AppError.unauthorized("Jeton Google invalide ou expiré", "GOOGLE_TOKEN_INVALID");
  }

  const payload = ticket.getPayload();

  if (!payload?.sub || !payload.email || payload.email_verified !== true) {
    throw AppError.unauthorized(
      "Google n'a pas confirmé l'adresse e-mail",
      "GOOGLE_EMAIL_NOT_VERIFIED",
    );
  }

  return {
    providerAccountId: payload.sub,
    email: payload.email.trim().toLowerCase(),
    name: payload.name?.trim() || null,
    nonce: payload.nonce,
  };
}

function clientMeta(meta) {
  return {
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  };
}

async function findGoogleAccount(providerAccountId) {
  return getPrisma().oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "GOOGLE",
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

async function loginWithGoogle({ idToken, device }, meta) {
  const identity = await verifyGoogleIdToken(idToken);
  if (identity.nonce !== nonce)
    throw AppError.unauthorized("Nonce invalide", "GOOGLE_NONCE_INVALID");
  await consumeNonce(nonce, "GOOGLE_NONCE_INVALID");
  const account = await findGoogleAccount(identity.providerAccountId);

  if (!account) {
    const existingUser = await getPrisma().user.findUnique({
      where: { email: identity.email },
      select: { id: true },
    });

    if (existingUser) {
      throw AppError.conflict(
        "Un compte existe déjà avec cette adresse. Connectez-vous avec votre méthode habituelle, puis associez Google depuis votre compte.",
        "ACCOUNT_LINK_REQUIRED",
      );
    }

    throw AppError.notFound(
      "Aucun compte Google SwiftGoma n'existe encore. Veuillez créer un compte.",
      "ACCOUNT_NOT_FOUND",
    );
  }

  const user = account.user;

  assertCanLogin(user, { email: true });

  await getPrisma().oAuthAccount.update({
    where: { id: account.id },
    data: {
      lastUsedAt: new Date(),
    },
  });

  return finishLogin({
    user,
    method: "GOOGLE",
    device,
    meta: clientMeta(meta),
  });
}

async function signupWithGoogle({ idToken, role, acceptTerms, confirmAge, device }, meta) {
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

  const identity = await verifyGoogleIdToken(idToken);
  const prisma = getPrisma();

  const linked = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerAccountId: {
        provider: "GOOGLE",
        providerAccountId: identity.providerAccountId,
      },
    },
    select: { id: true },
  });

  if (linked) {
    throw AppError.conflict(
      "Ce compte Google est déjà associé à SwiftGoma. Veuillez vous connecter.",
      "GOOGLE_ACCOUNT_ALREADY_REGISTERED",
    );
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: identity.email },
    select: { id: true, status: true },
  });

  if (existingUser && existingUser.status !== "PENDING") {
    throw AppError.conflict(
      "Un compte existe déjà avec cette adresse. Connectez-vous avec votre méthode habituelle, puis associez Google.",
      "ACCOUNT_LINK_REQUIRED",
    );
  }

  const now = new Date();

  let user;

  try {
    user = await prisma.$transaction(async (tx) => {
      const data = {
        name: identity.name,
        email: identity.email,
        emailVerifiedAt: now,
        role,
        status: "ACTIVE",
        termsVersion: authConfig.legal.termsVersion,
        privacyVersion: authConfig.legal.privacyVersion,
        termsAcceptedAt: now,
        ageConfirmedAt: now,
      };
      const created = existingUser
        ? await tx.user.update({ where: { id: existingUser.id }, data })
        : await tx.user.create({ data });

      await tx.oAuthAccount.create({
        data: {
          userId: created.id,
          provider: "GOOGLE",
          providerAccountId: identity.providerAccountId,
          email: identity.email,
          emailVerifiedAt: now,
        },
      });

      return tx.user.findUnique({
        where: { id: created.id },
        include: {
          totp: {
            select: { confirmedAt: true },
          },
        },
      });
    });
  } catch (err) {
    if (err?.code === "P2002") {
      throw AppError.conflict(
        "Ce compte Google ou cette adresse e-mail est déjà enregistré",
        "GOOGLE_ACCOUNT_ALREADY_REGISTERED",
      );
    }

    throw err;
  }

  await logActivity({
    userId: user.id,
    event: "SIGNUP_COMPLETED",
    method: "GOOGLE",
    deviceId: device.deviceId,
    deviceName: device.deviceName,
    platform: device.platform,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { provider: "GOOGLE" },
  });

  return finishLogin({
    user,
    method: "GOOGLE",
    device,
    meta: clientMeta(meta),
  });
}

async function linkGoogleAccount({ userId, idToken, stepUpCode }, meta) {
  const identity = await verifyGoogleIdToken(idToken);
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      status: true,
    },
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
        provider: "GOOGLE",
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
      "Ce compte Google est déjà associé à un autre compte SwiftGoma",
      "GOOGLE_ACCOUNT_ALREADY_LINKED",
    );
  }

  const existingGoogle = await prisma.oAuthAccount.findFirst({
    where: {
      userId,
      provider: "GOOGLE",
    },
    select: { id: true },
  });

  if (existingGoogle) {
    throw AppError.conflict(
      "Un compte Google est déjà associé à ce compte SwiftGoma",
      "GOOGLE_METHOD_ALREADY_LINKED",
    );
  }

  await consumeStepUp({ id: userId }, stepUpCode, meta, "oauth.link.google");

  try {
    await prisma.oAuthAccount.create({
      data: {
        userId,
        provider: "GOOGLE",
        providerAccountId: identity.providerAccountId,
        email: identity.email,
        emailVerifiedAt: new Date(),
      },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      throw AppError.conflict(
        "Ce compte Google vient d'être associé à un autre compte",
        "GOOGLE_ACCOUNT_ALREADY_LINKED",
      );
    }

    throw err;
  }

  await logActivity({
    userId,
    event: "OAUTH_ACCOUNT_LINKED",
    method: "GOOGLE",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { provider: "GOOGLE" },
  });

  await notifySecurityChange(userId, "LOGIN_METHOD_ADDED");

  return { linked: true, alreadyLinked: false };
}

module.exports = {
  loginWithGoogle,
  signupWithGoogle,
  linkGoogleAccount,
};
