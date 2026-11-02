const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { logActivity } = require("../../auth/services/activity.service");
const { revokeUserSessions } = require("../../auth/services/session.service");
const { getRedis } = require("../../../core/cache/redis");
const { destroyFile } = require("../../../core/storage/cloudinary");
const {
  loginFailKey,
  loginIpFailKey,
  userFailKey,
} = require("../../auth/services/password.service");
const {
  avatarPublicId,
  purgeAccount,
  buildUserExport,
} = require("../../users/services/user.service");

const { loadActiveUser, consumeStepUp } = require("../../auth/services/stepUp.service");
const { notifySecurityChange } = require("../../auth/services/securityNotice.service");

const STAFF = ["SUPPORT", "ADMIN"];

// The acting admin proves it is really them before a destructive action.
async function requireStepUp(actorId, code, meta, action) {
  const actor = await loadActiveUser(actorId);
  await consumeStepUp(actor, code, meta, action);
}

const listSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  role: true,
  status: true,
  verificationStatus: true,
  avatarUrl: true,
  lastLoginAt: true,
  createdAt: true,
};

async function listUsers({ page, limit, q, role, status, sort, order }) {
  const prisma = getPrisma();
  const where = {
    ...(role && { role }),
    ...(status && { status }),
    ...(q && {
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
        { phone: { contains: q } },
        { id: q },
      ],
    }),
  };

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      select: listSelect,
      orderBy: { [sort]: order },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { items, page, limit, total };
}

async function getUser(userId) {
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      ...listSelect,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
      secondaryEmail: true,
      secondaryPhone: true,
      termsVersion: true,
      termsAcceptedAt: true,
      deletionRequestedAt: true,
      deletionScheduledAt: true,
      deletedAt: true,
      updatedAt: true,
      addresses: true,
      supportRequests: { orderBy: { createdAt: "desc" }, take: 5 },
      _count: { select: { sessions: true, passkeys: true } },
    },
  });

  if (!user) throw AppError.notFound("Compte introuvable", "ACCOUNT_NOT_FOUND");
  return user;
}

async function listActivity(userId, { page, limit }) {
  const prisma = getPrisma();
  const where = { userId };
  const [total, items] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { items, page, limit, total };
}

async function forceLogout({ userId, actorId, reason }, meta) {
  if (userId === actorId) {
    throw AppError.forbidden("Vous ne pouvez pas modifier votre propre compte", "SELF_ACTION");
  }
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw AppError.notFound("Compte introuvable", "ACCOUNT_NOT_FOUND");

  await revokeUserSessions(userId, { reason: "ADMIN_REVOKED" });
  await logActivity({
    userId,
    event: "SESSIONS_REVOKED_BY_ADMIN",
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { actorId, reason },
  });
  await notifySecurityChange(userId, "ADMIN_SESSIONS_REVOKED");
}

async function changeRole({ userId, actorId, role, reason }, meta) {
  if (userId === actorId) {
    throw AppError.forbidden("Vous ne pouvez pas modifier votre propre compte", "SELF_ACTION");
  }
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === "DELETED") {
    throw AppError.notFound("Compte introuvable", "ACCOUNT_NOT_FOUND");
  }
  if (STAFF.includes(user.role)) {
    throw AppError.forbidden(
      "Les comptes du personnel se gèrent via la gestion du personnel",
      "STAFF_ROLE_PROTECTED",
    );
  }
  if (user.role === role) {
    throw AppError.conflict("Ce compte a déjà ce rôle", "ROLE_UNCHANGED");
  }

  await prisma.user.update({ where: { id: userId }, data: { role } });

  await revokeUserSessions(userId, { reason: "ROLE_CHANGED" });

  await logActivity({
    userId,
    event: "ROLE_CHANGED",
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { actorId, reason, previousRole: user.role, newRole: role },
  });
  await notifySecurityChange(userId, "ADMIN_ROLE_CHANGED");
}

function logAdmin(userId, event, meta, metadata) {
  return logActivity({
    userId,
    event,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata,
  });
}

async function loadTarget(userId, actorId) {
  if (userId === actorId) {
    throw AppError.forbidden("Vous ne pouvez pas modifier votre propre compte", "SELF_ACTION");
  }
  const user = await getPrisma().user.findUnique({ where: { id: userId } });
  if (!user || user.status === "DELETED") {
    throw AppError.notFound("Compte introuvable", "ACCOUNT_NOT_FOUND");
  }
  if (STAFF.includes(user.role)) {
    throw AppError.forbidden("Compte du personnel protégé", "STAFF_PROTECTED");
  }
  return user;
}

async function unlockAccount({ userId, actorId, reason }, meta) {
  const user = await loadTarget(userId, actorId);
  const redis = getRedis();
  const keys = [userFailKey(userId)];

  if (user.email) {
    keys.push(loginFailKey(user.email));
    let cursor = "0";
    do {
      const [next, found] = await redis.scan(
        cursor,
        "MATCH",
        loginIpFailKey(user.email, "*"),
        "COUNT",
        100,
      );
      keys.push(...found);
      cursor = next;
    } while (cursor !== "0");
  }

  await redis.del(...keys);
  await logAdmin(userId, "ACCOUNT_UNLOCKED", meta, { actorId, reason });
  await notifySecurityChange(userId, "ACCOUNT_UNLOCKED");
}

async function cancelDeletion({ userId, actorId, reason }, meta) {
  const user = await loadTarget(userId, actorId);
  if (user.status !== "PENDING_DELETION") {
    throw AppError.conflict("Aucune suppression en cours", "NO_PENDING_DELETION");
  }
  await getPrisma().user.update({
    where: { id: userId },
    data: {
      status: user.statusBeforeDeletion ?? "ACTIVE",
      statusBeforeDeletion: null,
      deletionRequestedAt: null,
      deletionScheduledAt: null,
    },
  });
  await logAdmin(userId, "ACCOUNT_DELETION_CANCELLED", meta, { actorId, reason });
  await notifySecurityChange(userId, "ACCOUNT_DELETION_CANCELLED");
}

async function forceDeletion({ userId, actorId, reason, stepUpCode }, meta) {
  const user = await loadTarget(userId, actorId);
  if (user.status === "BANNED") {
    throw AppError.conflict("Un compte banni ne peut pas être supprimé", "BANNED_ACCOUNT");
  }

  await requireStepUp(actorId, stepUpCode, meta, "admin.deletion.force");
  const prisma = getPrisma();
  const now = new Date();

  if (user.status !== "PENDING_DELETION") {
    await prisma.user.update({
      where: { id: userId },
      data: {
        status: "PENDING_DELETION",
        statusBeforeDeletion: user.status,
        deletionRequestedAt: now,
        deletionScheduledAt: now,
      },
    });
  }
  await revokeUserSessions(userId, { reason: "ADMIN_DELETION" });
  await logAdmin(userId, "ACCOUNT_DELETION_FORCED", meta, { actorId, reason });
  // The purge erases the contacts, so they are passed explicitly before it runs.
  await notifySecurityChange(userId, "ADMIN_DELETION_FORCED", {
    contacts: { email: user.email, phone: user.phone },
  });
  await purgeAccount(userId);
}

async function resetPassword({ userId, actorId, reason, stepUpCode }, meta) {
  await loadTarget(userId, actorId);
  await requireStepUp(actorId, stepUpCode, meta, "admin.password.reset");
  await getPrisma().user.update({ where: { id: userId }, data: { passwordHash: null } });
  await revokeUserSessions(userId, { reason: "PASSWORD_RESET_BY_ADMIN" });
  await logAdmin(userId, "PASSWORD_RESET_BY_ADMIN", meta, { actorId, reason });
  await notifySecurityChange(userId, "ADMIN_PASSWORD_RESET");
}

async function resetTwoFactor({ userId, actorId, reason, stepUpCode }, meta) {
  await loadTarget(userId, actorId);
  await requireStepUp(actorId, stepUpCode, meta, "admin.2fa.reset");
  const prisma = getPrisma();
  await prisma.$transaction([
    prisma.totpCredential.deleteMany({ where: { userId } }),
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.passkey.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);
  await revokeUserSessions(userId, { reason: "TWO_FACTOR_RESET_BY_ADMIN" });
  await logAdmin(userId, "TWO_FACTOR_RESET_BY_ADMIN", meta, { actorId, reason });
  await notifySecurityChange(userId, "ADMIN_TWO_FACTOR_RESET");
}

async function moderateProfile({ userId, actorId, reason, removeAvatar, clearName }, meta) {
  const user = await loadTarget(userId, actorId);
  const data = {};
  if (removeAvatar && user.avatarUrl) {
    await destroyFile({ publicId: avatarPublicId(userId) });
    data.avatarUrl = null;
  }
  if (clearName) data.name = null;

  if (Object.keys(data).length) await getPrisma().user.update({ where: { id: userId }, data });
  await logAdmin(userId, "PROFILE_MODERATED", meta, {
    actorId,
    reason,
    removedAvatar: "avatarUrl" in data,
    clearedName: "name" in data,
  });
  await notifySecurityChange(userId, "ADMIN_PROFILE_MODERATED");
}

async function updateContact({ userId, actorId, reason, field, value }, meta) {
  const user = await loadTarget(userId, actorId);
  const verifiedKey = field === "email" ? "emailVerifiedAt" : "phoneVerifiedAt";
  try {
    await getPrisma().user.update({
      where: { id: userId },
      data: { ...(value && { [field]: value }), [verifiedKey]: null },
    });
  } catch (err) {
    if (err.code === "P2002") {
      throw AppError.conflict("Ce contact est déjà utilisé", "CONTACT_TAKEN");
    }
    throw err;
  }
  await revokeUserSessions(userId, { reason: "CONTACT_UPDATED_BY_ADMIN" });
  await logAdmin(userId, "CONTACT_UPDATED_BY_ADMIN", meta, {
    actorId,
    reason,
    field,
    replaced: Boolean(value),
    previous: user[field],
  });
  // Warn the contacts the account had before the change.
  await notifySecurityChange(userId, "ADMIN_CONTACT_UPDATED", {
    contacts: { email: user.email, phone: user.phone },
  });
}

async function listAudit({ page, limit, userId, actorId, event, success, from, to }) {
  const prisma = getPrisma();
  const where = {
    ...(userId && { userId }),
    ...(event && { event }),
    ...(success !== undefined && { success }),
    ...(actorId && { metadata: { path: ["actorId"], equals: actorId } }),
    ...((from || to) && { createdAt: { ...(from && { gte: from }), ...(to && { lte: to }) } }),
  };
  const [total, items] = await Promise.all([
    prisma.activityLog.count({ where }),
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);
  return { items, page, limit, total };
}

async function exportUserData({ userId, actorId, reason }, meta) {
  await loadTarget(userId, actorId);
  const data = await buildUserExport(userId);
  await logAdmin(userId, "DATA_EXPORTED_BY_ADMIN", meta, { actorId, reason });
  await notifySecurityChange(userId, "ADMIN_DATA_EXPORTED");
  return data;
}

module.exports = {
  listUsers,
  getUser,
  listActivity,
  forceLogout,
  changeRole,
  unlockAccount,
  cancelDeletion,
  forceDeletion,
  resetPassword,
  resetTwoFactor,
  moderateProfile,
  updateContact,
  listAudit,
  exportUserData,
};
