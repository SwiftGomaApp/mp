const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { logActivity } = require("./activity.service");
const { assertCanLogin } = require("./auth.service");
const { notifySecurityChange } = require("./securityNotice.service");

async function linkToVerifiedAccount({ provider, identity }, meta) {
  if (!identity.email) return null;

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { email: identity.email },
    include: { totp: { select: { confirmedAt: true } } },
  });

  if (!user || !user.emailVerifiedAt || user.status === "PENDING") return null;

  assertCanLogin(user, { email: true });

  const sameProvider = await prisma.oAuthAccount.findFirst({
    where: { userId: user.id, provider },
    select: { id: true },
  });
  if (sameProvider) {
    throw AppError.conflict(
      "Un autre compte de ce fournisseur est déjà associé à ce compte SwiftGoma",
      "OAUTH_METHOD_ALREADY_LINKED",
    );
  }

  const now = new Date();
  try {
    await prisma.oAuthAccount.create({
      data: {
        userId: user.id,
        provider,
        providerAccountId: identity.providerAccountId,
        email: identity.email,
        emailVerifiedAt: now,
        lastUsedAt: now,
      },
    });
  } catch (err) {
    if (err?.code === "P2002") {
      throw AppError.conflict(
        "Ce compte est déjà associé à un autre compte SwiftGoma",
        "OAUTH_ACCOUNT_ALREADY_LINKED",
      );
    }
    throw err;
  }

  await logActivity({
    userId: user.id,
    event: "OAUTH_ACCOUNT_LINKED",
    method: provider,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { provider, via: "verified-email" },
  });
  await notifySecurityChange(user.id, "LOGIN_METHOD_ADDED");

  return user;
}

module.exports = { linkToVerifiedAccount };
