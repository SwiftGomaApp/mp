const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { authConfig } = require("../config/auth.config");
const { logActivity } = require("./activity.service");
const { consumeStepUp, loadActiveUser } = require("./stepUp.service");
const { notifySecurityChange } = require("./securityNotice.service");

const hasVerifiedEmail = (user) => Boolean(user.email && user.emailVerifiedAt);
const hasVerifiedPhone = (user) => Boolean(user.phone && user.phoneVerifiedAt);

function activeMethods(user, providers, passkeys) {
  const methods = [];
  if (hasVerifiedEmail(user)) methods.push("EMAIL");
  if (hasVerifiedPhone(user)) methods.push("PHONE");
  if (user.passwordHash && hasVerifiedEmail(user)) methods.push("PASSWORD");
  methods.push(...providers);
  if (passkeys > 0) methods.push("PASSKEY");
  return methods;
}

async function loadMethodState(userId) {
  const prisma = getPrisma();
  const user = await loadActiveUser(userId);
  const [oauth, passkeys] = await Promise.all([
    prisma.oAuthAccount.findMany({ where: { userId }, select: { provider: true, email: true } }),
    prisma.passkey.count({ where: { userId, revokedAt: null } }),
  ]);
  return { user, oauth, passkeys };
}

async function listMethods(userId) {
  const { user, oauth, passkeys } = await loadMethodState(userId);
  const find = (provider) => oauth.find((account) => account.provider === provider);

  return {
    email: user.email ? { value: user.email, verified: Boolean(user.emailVerifiedAt) } : null,
    phone: user.phone ? { value: user.phone, verified: Boolean(user.phoneVerifiedAt) } : null,
    password: Boolean(user.passwordHash),
    google: find("GOOGLE") ? { email: find("GOOGLE").email } : null,
    apple: find("APPLE") ? { email: find("APPLE").email } : null,
    passkeys,
  };
}

function assertCanRemove({ user, oauth, passkeys }, method) {
  const providers = oauth.map((account) => account.provider);
  const after = { ...user };
  let remainingProviders = providers;

  if (method === "EMAIL") {
    if (authConfig.staffRoles.includes(user.role)) {
      throw AppError.forbidden(
        "L'e-mail des membres de l'équipe ne peut pas être retiré",
        "STAFF_EMAIL_REQUIRED",
      );
    }
    after.email = null;
    after.emailVerifiedAt = null;
  } else if (method === "PHONE") {
    after.phone = null;
    after.phoneVerifiedAt = null;
  } else {
    remainingProviders = providers.filter((provider) => provider !== method);
  }

  if (activeMethods(after, remainingProviders, passkeys).length === 0) {
    throw AppError.forbidden(
      "Vous ne pouvez pas retirer votre dernière façon de vous connecter",
      "LAST_LOGIN_METHOD",
    );
  }

  if ((method === "EMAIL" || method === "PHONE") && !hasVerifiedEmail(after) && !hasVerifiedPhone(after)) {
    throw AppError.forbidden(
      "Vous devez garder au moins un e-mail ou un numéro vérifié",
      "LAST_CONTACT",
    );
  }
}

async function removeMethod({ userId, method, code }, meta) {
  const prisma = getPrisma();
  const state = await loadMethodState(userId);
  const { user, oauth } = state;

  if (method === "EMAIL" && !hasVerifiedEmail(user)) {
    throw AppError.notFound("Aucun e-mail n'est associé à ce compte", "METHOD_NOT_FOUND");
  }
  if (method === "PHONE" && !hasVerifiedPhone(user)) {
    throw AppError.notFound("Aucun numéro n'est associé à ce compte", "METHOD_NOT_FOUND");
  }
  if ((method === "GOOGLE" || method === "APPLE") && !oauth.some((a) => a.provider === method)) {
    throw AppError.notFound("Cette méthode n'est pas associée à ce compte", "METHOD_NOT_FOUND");
  }

  assertCanRemove(state, method);
  await consumeStepUp(user, code, meta, `method.remove.${method.toLowerCase()}`);

  if (method === "EMAIL") {
    await prisma.user.update({ where: { id: userId }, data: { email: null, emailVerifiedAt: null } });
  } else if (method === "PHONE") {
    await prisma.user.update({ where: { id: userId }, data: { phone: null, phoneVerifiedAt: null } });
  } else {
    await prisma.oAuthAccount.deleteMany({ where: { userId, provider: method } });
  }

  await logActivity({
    userId,
    event: "LOGIN_METHOD_REMOVED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { method },
  });
  await notifySecurityChange(userId, "LOGIN_METHOD_REMOVED");

  return listMethods(userId);
}

module.exports = { listMethods, removeMethod };
