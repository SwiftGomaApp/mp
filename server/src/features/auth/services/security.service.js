const { getPrisma } = require("../../../core/db/prisma");
const { authConfig } = require("../config/auth.config");
const { loadActiveUser } = require("./stepUp.service");

const ACTIVITY_CATEGORIES = {
  LOGIN: ["LOGIN_SUCCESS", "LOGIN_FAILED", "ACCOUNT_LOCKED", "SIGNUP_COMPLETED"],
  DEVICE: ["NEW_DEVICE"],
  SECURITY: [
    "LOGOUT_ALL",
    "TOKEN_REUSE_DETECTED",
    "PASSWORD_SET",
    "PASSWORD_CHANGED",
    "PASSWORD_REMOVED",
    "PASSWORD_RESET_COMPLETED",
    "EMAIL_CHANGED",
    "PHONE_CHANGED",
    "TOTP_ENABLED",
    "TOTP_DISABLED",
    "BACKUP_CODES_GENERATED",
    "BACKUP_CODE_USED",
    "PASSKEY_ADDED",
    "PASSKEY_RENAMED",
    "PASSKEY_REMOVED",
    "OAUTH_ACCOUNT_LINKED",
    "LOGIN_METHOD_REMOVED",
    "SECONDARY_EMAIL_ADDED",
    "SECONDARY_EMAIL_CHANGED",
    "SECONDARY_EMAIL_REMOVED",
    "SECONDARY_PHONE_ADDED",
    "SECONDARY_PHONE_CHANGED",
    "SECONDARY_PHONE_REMOVED",
    "ACCOUNT_RECOVERY_REQUESTED",
    "ACCOUNT_RECOVERY_CANCELLED",
    "ACCOUNT_RECOVERY_COMPLETED",
  ],
};

async function getActivity(userId, { page, limit, category }) {
  const prisma = getPrisma();
  const events = category
    ? ACTIVITY_CATEGORIES[category]
    : Object.values(ACTIVITY_CATEGORIES).flat();

  const where = {
    userId,
    event: { in: events },
    createdAt: { gte: new Date(Date.now() - authConfig.activityLogWindowMs) },
  };

  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        event: true,
        success: true,
        method: true,
        deviceName: true,
        platform: true,
        city: true,
        country: true,
        createdAt: true,
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  return { items, page, limit, total };
}

async function getSecurityChecklist(userId) {
  const prisma = getPrisma();
  const user = await loadActiveUser(userId);

  const [totp, passkeys, pendingRecovery] = await Promise.all([
    prisma.totpCredential.findUnique({ where: { userId }, select: { confirmedAt: true } }),
    prisma.passkey.count({ where: { userId, revokedAt: null } }),
    prisma.accountRecoveryRequest.findFirst({
      where: { userId, status: "PENDING", expiresAt: { gt: new Date() } },
      select: { id: true, availableAt: true },
    }),
  ]);

  return {
    items: [
      { key: "EMAIL_VERIFIED", done: Boolean(user.email && user.emailVerifiedAt) },
      { key: "PHONE_VERIFIED", done: Boolean(user.phone && user.phoneVerifiedAt) },
      {
        key: "RECOVERY_CONTACT",
        done: Boolean(user.secondaryEmailVerifiedAt || user.secondaryPhoneVerifiedAt),
      },
      { key: "TWO_FACTOR", done: Boolean(totp?.confirmedAt) },
      { key: "PASSKEY", done: passkeys > 0 },
    ],
    pendingRecovery,
  };
}

module.exports = { ACTIVITY_CATEGORIES, getActivity, getSecurityChecklist };
