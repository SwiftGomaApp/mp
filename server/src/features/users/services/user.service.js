const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { uploadFile, destroyFile, folderPath } = require("../../../core/storage/cloudinary");
const { logActivity } = require("../../auth/services/activity.service");
const { usersConfig } = require("../config/users.config");
const { getRedis } = require("../../../core/cache/redis");
const { issueOtp, verifyOtp, OTP_PURPOSES } = require("../../../core/auth/otp");
const { queueOtpEmail, queueOtpSms } = require("../../../core/queue/notifications");
const { consumeStepUp } = require("../../auth/services/stepUp.service");
const { notifySecurityChange } = require("../../auth/services/securityNotice.service");
const { logger } = require("../../../core/logger/logger");
const { revokeUserSessions } = require("../../auth/services/session.service");

const PROFILE_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  avatarUrl: true,
  role: true,
  status: true,
  verificationStatus: true,
  createdAt: true,
};

const ADDRESS_SELECT = {
  id: true,
  label: true,
  recipientName: true,
  recipientPhone: true,
  line1: true,
  quartier: true,
  commune: true,
  city: true,
  landmark: true,
  latitude: true,
  longitude: true,
  isDefault: true,
  createdAt: true,
  updatedAt: true,
};

const AVATAR_SIZE = 512;

function avatarPublicId(userId) {
  return folderPath("avatars", userId);
}

function toProfile(user) {
  const { emailVerifiedAt, phoneVerifiedAt, ...rest } = user;

  return {
    ...rest,
    emailVerified: Boolean(emailVerifiedAt),
    phoneVerified: Boolean(phoneVerifiedAt),
  };
}

async function loadActiveUser(userId) {
  const user = await getPrisma().user.findUnique({ where: { id: userId }, select: PROFILE_SELECT });

  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_REVOKED");
  }

  return user;
}

async function getProfile(userId) {
  return toProfile(await loadActiveUser(userId));
}

async function updateProfile({ userId, name }, meta = {}) {
  const current = await loadActiveUser(userId);

  if (current.name === name) return toProfile(current);

  const updated = await getPrisma().user.update({
    where: { id: userId },
    data: { name },
    select: PROFILE_SELECT,
  });

  await logActivity({
    userId,
    event: "PROFILE_UPDATED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    target: "name",
  });

  return toProfile(updated);
}

async function setAvatar({ userId, file }, meta = {}) {
  await loadActiveUser(userId);

  const uploaded = await uploadFile(file.buffer, {
    resourceType: "image",
    public_id: avatarPublicId(userId),
    overwrite: true,
    invalidate: true,
    transformation: [
      {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        crop: "fill",
        gravity: "face",
        quality: "auto",
        fetch_format: "auto",
      },
    ],
  });

  const updated = await getPrisma().user.update({
    where: { id: userId },
    data: { avatarUrl: uploaded.url },
    select: PROFILE_SELECT,
  });

  await logActivity({
    userId,
    event: "AVATAR_CHANGED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    target: "avatar",
    metadata: { action: "set" },
  });

  return toProfile(updated);
}

async function removeAvatar({ userId }, meta = {}) {
  const current = await loadActiveUser(userId);
  if (!current.avatarUrl) return toProfile(current);

  await destroyFile({ publicId: avatarPublicId(userId) });

  const updated = await getPrisma().user.update({
    where: { id: userId },
    data: { avatarUrl: null },
    select: PROFILE_SELECT,
  });

  await logActivity({
    userId,
    event: "AVATAR_CHANGED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    target: "avatar",
    metadata: { action: "removed" },
  });

  return toProfile(updated);
}

async function loadBuyer(userId) {
  const user = await loadActiveUser(userId);

  if (!usersConfig.addresses.allowedRoles.includes(user.role)) {
    throw AppError.forbidden(
      "Seuls les acheteurs peuvent enregistrer des adresses de livraison",
      "ADDRESSES_BUYER_ONLY",
    );
  }

  return user;
}

async function findOwned(db, userId, id) {
  const address = await db.address.findFirst({ where: { id, userId }, select: ADDRESS_SELECT });

  if (!address) throw AppError.notFound("Adresse introuvable", "ADDRESS_NOT_FOUND");

  return address;
}

function logChange(userId, event, addressId, meta = {}) {
  return logActivity({
    userId,
    event,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    target: addressId,
  });
}

async function listAddresses(userId) {
  await loadBuyer(userId);

  const addresses = await getPrisma().address.findMany({
    where: { userId },
    select: ADDRESS_SELECT,
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return { addresses };
}

async function createAddress({ userId, data }, meta = {}) {
  await loadBuyer(userId);

  const address = await getPrisma().$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });

    if (count >= usersConfig.addresses.maxPerUser) {
      throw AppError.conflict(
        `Vous ne pouvez pas enregistrer plus de ${usersConfig.addresses.maxPerUser} adresses`,
        "ADDRESS_LIMIT_REACHED",
      );
    }

    const makeDefault = count === 0 || data.isDefault === true;

    if (makeDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.address.create({
      data: {
        ...data,
        city: data.city ?? usersConfig.addresses.defaultCity,
        isDefault: makeDefault,
        userId,
      },
      select: ADDRESS_SELECT,
    });
  });

  await logChange(userId, "ADDRESS_ADDED", address.id, meta);

  return { address };
}

async function updateAddress({ userId, id, data }, meta = {}) {
  await loadBuyer(userId);

  const address = await getPrisma().$transaction(async (tx) => {
    const current = await findOwned(tx, userId, id);

    if (data.isDefault === false && current.isDefault) {
      throw AppError.badRequest(
        "Choisissez une autre adresse comme adresse par défaut",
        undefined,
        "DEFAULT_ADDRESS_REQUIRED",
      );
    }

    if (data.isDefault === true && !current.isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    return tx.address.update({ where: { id }, data, select: ADDRESS_SELECT });
  });

  await logChange(userId, "ADDRESS_UPDATED", id, meta);

  return { address };
}

async function removeAddress({ userId, id }, meta = {}) {
  await loadBuyer(userId);

  await getPrisma().$transaction(async (tx) => {
    const current = await findOwned(tx, userId, id);

    await tx.address.delete({ where: { id } });

    if (current.isDefault) {
      const next = await tx.address.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
        select: { id: true },
      });

      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });

  await logChange(userId, "ADDRESS_REMOVED", id, meta);
}

const PENDING_TTL_SECONDS = 10 * 60;

const PRIMARY_CONTACTS = {
  EMAIL: { field: "email", verifiedField: "emailVerifiedAt", event: "EMAIL_CHANGED" },
  PHONE: { field: "phone", verifiedField: "phoneVerifiedAt", event: "PHONE_CHANGED" },
};

function pendingKey(userId, kind) {
  return `primary-contact:pending:${userId}:${kind.toLowerCase()}`;
}

function otpPurpose(userId, kind) {
  return `${OTP_PURPOSES.STEP_UP}:primary-contact:${kind.toLowerCase()}:${userId}`;
}

function normalizeContact(kind, value) {
  const contact = String(value).trim();

  return kind === "EMAIL" ? contact.toLowerCase() : contact;
}

function metaFields(meta = {}) {
  return { ipAddress: meta.ipAddress, userAgent: meta.userAgent };
}

async function assertPrimaryContactAvailable(contact, userId) {
  const existing = await getPrisma().user.findFirst({
    where: {
      OR: [
        { email: contact },
        { phone: contact },
        { secondaryEmail: contact },
        { secondaryPhone: contact },
      ],
    },
    select: { id: true },
  });

  if (!existing) return;

  if (existing.id === userId) {
    throw AppError.conflict(
      "Ce contact est déjà enregistré sur votre compte",
      "CONTACT_ALREADY_ON_ACCOUNT",
    );
  }

  throw AppError.conflict(
    "Cet e-mail ou ce numéro est déjà associé à un autre compte",
    "CONTACT_ALREADY_IN_USE",
  );
}

async function requestContactChange({ userId, kind, value, stepUpCode }, meta = {}) {
  const config = PRIMARY_CONTACTS[kind];
  const user = await loadActiveUser(userId);
  const contact = normalizeContact(kind, value);

  if (user[config.field] === contact) {
    throw AppError.conflict("Ce contact est déjà votre contact principal", "CONTACT_UNCHANGED");
  }

  await consumeStepUp(user, stepUpCode, meta, `primary_contact.${kind.toLowerCase()}`);

  await assertPrimaryContactAvailable(contact, userId);

  const { code, expiresMinutes } = await issueOtp({
    purpose: otpPurpose(userId, kind),
    target: contact,
  });

  await getRedis().set(pendingKey(userId, kind), contact, "EX", PENDING_TTL_SECONDS);

  if (kind === "EMAIL") {
    await queueOtpEmail({
      to: contact,
      name: user.name,
      code,
      expiresMinutes,
      purpose: "contact-verification",
    });
  } else {
    await queueOtpSms({ to: contact, code, expiresMinutes });
  }

  await logActivity({
    userId,
    event: "OTP_REQUESTED",
    method: kind === "EMAIL" ? "EMAIL_OTP" : "PHONE_OTP",
    ...metaFields(meta),
    metadata: {
      purpose: OTP_PURPOSES.STEP_UP,
      action: `primary_contact.${kind.toLowerCase()}.request`,
    },
  });

  return { message: "Un code de vérification a été envoyé", kind, contact, expiresMinutes };
}

async function verifyContactChange({ userId, kind, value, code }, meta = {}) {
  const config = PRIMARY_CONTACTS[kind];
  const contact = normalizeContact(kind, value);
  const redis = getRedis();

  const user = await loadActiveUser(userId);
  const previous = user[config.field];

  const storedContact = await redis.get(pendingKey(userId, kind));

  if (!storedContact || storedContact !== contact) {
    throw AppError.badRequest(
      "Demande de vérification invalide ou expirée",
      undefined,
      "CONTACT_REQUEST_EXPIRED",
    );
  }

  await assertPrimaryContactAvailable(contact, userId);

  await verifyOtp({ purpose: otpPurpose(userId, kind), target: contact, code });

  try {
    const result = await getPrisma().user.updateMany({
      where: { id: userId, status: "ACTIVE" },
      data: { [config.field]: contact, [config.verifiedField]: new Date() },
    });

    if (result.count !== 1) {
      throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_REVOKED");
    }
  } catch (err) {
    if (err.code === "P2002") {
      throw AppError.conflict(
        "Cet e-mail ou ce numéro est déjà associé à un compte",
        "CONTACT_ALREADY_IN_USE",
      );
    }

    throw err;
  }

  await redis.del(pendingKey(userId, kind));

  await logActivity({
    userId,
    event: config.event,
    method: kind === "EMAIL" ? "EMAIL_OTP" : "PHONE_OTP",
    ...metaFields(meta),
    target: contact,
    metadata: { action: `primary_contact.${kind.toLowerCase()}.verified`, added: !previous },
  });

  await notifySecurityChange(
    userId,
    previous ? "PRIMARY_CONTACT_CHANGED" : "PRIMARY_CONTACT_ADDED",
  );

  if (previous) {
    await notifySecurityChange(userId, "PRIMARY_CONTACT_CHANGED", {
      contacts: kind === "EMAIL" ? { email: previous } : { phone: previous },
    });
  }

  return { message: "Contact mis à jour avec succès", user: await getProfile(userId) };
}

const PREFERENCE_DEFAULTS = Object.freeze({
  theme: "SYSTEM",
  dataSaver: false,
  preferredMomoNumber: null,
  reviewNameDisplay: "FIRST_NAME_INITIAL",
  newOrderSound: "default",
});

function preferenceKeysFor(role) {
  const { buyerOnlyKeys, sellerOnlyKeys } = usersConfig.preferences;
  const keys = ["theme", "dataSaver"];

  if (role === "BUYER") keys.push(...buyerOnlyKeys);
  if (role === "SELLER") keys.push(...sellerOnlyKeys);

  return keys;
}

function pickPreferences(row, keys) {
  const source = row ?? PREFERENCE_DEFAULTS;

  return Object.fromEntries(keys.map((key) => [key, source[key] ?? PREFERENCE_DEFAULTS[key]]));
}

async function getPreferences(userId) {
  const user = await loadActiveUser(userId);
  const row = await getPrisma().userPreferences.findUnique({ where: { userId } });

  return { preferences: pickPreferences(row, preferenceKeysFor(user.role)) };
}

async function updatePreferences({ userId, data }, meta = {}) {
  const user = await loadActiveUser(userId);
  const allowed = preferenceKeysFor(user.role);
  const forbidden = Object.keys(data).filter((key) => !allowed.includes(key));

  if (forbidden.length) {
    throw AppError.badRequest(
      "Ces préférences ne sont pas disponibles pour votre rôle",
      forbidden.map((field) => ({ field })),
      "PREFERENCE_NOT_ALLOWED",
    );
  }

  const row = await getPrisma().userPreferences.upsert({
    where: { userId },
    create: { userId, ...data },
    update: data,
  });

  await logActivity({
    userId,
    event: "PREFERENCES_UPDATED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    target: "preferences",
    metadata: { keys: Object.keys(data) },
  });

  return { preferences: pickPreferences(row, allowed) };
}

const DAY_MS = 24 * 60 * 60 * 1000;

function assertDeletable(user) {
  if (usersConfig.deletion.staffRolesExcluded.includes(user.role)) {
    throw AppError.forbidden(
      "Les comptes de l'équipe SwiftGoma sont supprimés par l'équipe",
      "STAFF_DELETION_NOT_ALLOWED",
    );
  }
}

async function findDeletionBlockers() {
  return [];
}

async function getDeletionOverview(userId) {
  const user = await loadActiveUser(userId);
  assertDeletable(user);

  const [blockers, addresses] = await Promise.all([
    findDeletionBlockers(user),
    getPrisma().address.count({ where: { userId } }),
  ]);

  return {
    canDelete: blockers.length === 0,
    blockers,
    gracePeriodDays: Math.round(usersConfig.deletion.gracePeriodMs / DAY_MS),
    erased: { addresses },
    kept: ["ORDERS", "PAYMENTS", "REVIEWS"],
  };
}

async function requestAccountDeletion({ userId, stepUpCode }, meta = {}) {
  const user = await loadActiveUser(userId);
  assertDeletable(user);

  await consumeStepUp(user, stepUpCode, meta, "account.deletion");

  const blockers = await findDeletionBlockers(user);

  if (blockers.length) {
    throw new AppError(
      409,
      "DELETION_BLOCKED",
      "Votre compte ne peut pas être supprimé pour le moment",
      blockers,
    );
  }

  const now = new Date();
  const scheduledAt = new Date(now.getTime() + usersConfig.deletion.gracePeriodMs);
  const prisma = getPrisma();

  const result = await prisma.user.updateMany({
    where: { id: userId, status: "ACTIVE" },
    data: {
      status: "PENDING_DELETION",
      deletionRequestedAt: now,
      deletionScheduledAt: scheduledAt,
    },
  });

  if (result.count !== 1) {
    throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_REVOKED");
  }

  await revokeUserSessions(userId, { reason: "ACCOUNT_DELETION" });
  await prisma.deviceRegistration.updateMany({
    where: { userId, disabledAt: null },
    data: { disabledAt: now },
  });

  await logActivity({
    userId,
    event: "ACCOUNT_DELETION_REQUESTED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { scheduledAt: scheduledAt.toISOString() },
  });
  await notifySecurityChange(userId, "ACCOUNT_DELETION_REQUESTED");

  return { message: "La suppression de votre compte est programmée", scheduledAt };
}

async function purgeAccount(userId) {
  const prisma = getPrisma();

  const pending = await prisma.user.findFirst({
    where: { id: userId, status: "PENDING_DELETION" },
    select: { id: true },
  });

  if (!pending) return false;

  await destroyFile({ publicId: avatarPublicId(userId) });

  await prisma.$transaction([
    prisma.session.deleteMany({ where: { userId } }),
    prisma.passkey.deleteMany({ where: { userId } }),
    prisma.totpCredential.deleteMany({ where: { userId } }),
    prisma.backupCode.deleteMany({ where: { userId } }),
    prisma.oAuthAccount.deleteMany({ where: { userId } }),
    prisma.accountRecoveryRequest.deleteMany({ where: { userId } }),
    prisma.supportRequest.deleteMany({ where: { userId } }),
    prisma.address.deleteMany({ where: { userId } }),
    prisma.userPreferences.deleteMany({ where: { userId } }),
    prisma.notification.deleteMany({ where: { userId } }),
    prisma.notificationPreference.deleteMany({ where: { userId } }),
    prisma.notificationSettings.deleteMany({ where: { userId } }),
    prisma.deviceRegistration.deleteMany({ where: { userId } }),
    prisma.campaignRecipient.updateMany({
      where: { userId },
      data: { name: null, email: "supprimé" },
    }),
    prisma.user.update({
      where: { id: userId, status: "PENDING_DELETION" },
      data: {
        status: "DELETED",
        name: null,
        email: null,
        phone: null,
        emailVerifiedAt: null,
        phoneVerifiedAt: null,
        secondaryEmail: null,
        secondaryEmailVerifiedAt: null,
        secondaryPhone: null,
        secondaryPhoneVerifiedAt: null,
        passwordHash: null,
        avatarUrl: null,
        deletionScheduledAt: null,
        deletedAt: new Date(),
      },
    }),
  ]);

  await logActivity({ userId, event: "ACCOUNT_DELETED" });

  return true;
}

async function purgeDueAccounts(batchSize = 50) {
  const due = await getPrisma().user.findMany({
    where: { status: "PENDING_DELETION", deletionScheduledAt: { lte: new Date() } },
    select: { id: true },
    take: batchSize,
  });

  let purged = 0;

  for (const { id } of due) {
    try {
      if (await purgeAccount(id)) purged += 1;
    } catch (err) {
      logger.error({ err, userId: id }, "Failed to purge account");
    }
  }

  return purged;
}

const EXPORT_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  emailVerifiedAt: true,
  phoneVerifiedAt: true,
  secondaryEmail: true,
  secondaryEmailVerifiedAt: true,
  secondaryPhone: true,
  secondaryPhoneVerifiedAt: true,
  avatarUrl: true,
  role: true,
  status: true,
  verificationStatus: true,
  termsVersion: true,
  privacyVersion: true,
  termsAcceptedAt: true,
  ageConfirmedAt: true,
  lastLoginAt: true,
  createdAt: true,
};

const EXPORT_ACTIVITY_LIMIT = 5000;

async function reportSuspiciousActivity({ userId, activityId }, meta = {}) {
  await loadActiveUser(userId);
  const prisma = getPrisma();

  const entry = await prisma.activityLog.findFirst({
    where: { id: activityId, userId },
    select: { id: true, event: true, deviceName: true, city: true, country: true, createdAt: true },
  });

  if (!entry) throw AppError.notFound("Activité introuvable", "ACTIVITY_NOT_FOUND");

  const now = new Date();

  const revoked = await revokeUserSessions(userId, { reason: "SUSPICIOUS_ACTIVITY" });
  await prisma.deviceRegistration.updateMany({
    where: { userId, disabledAt: null },
    data: { disabledAt: now },
  });
  const cleared = await prisma.user.updateMany({
    where: { id: userId, passwordHash: { not: null } },
    data: { passwordHash: null },
  });

  const recent = await prisma.supportRequest.findFirst({
    where: {
      userId,
      status: "OPEN",
      createdAt: { gt: new Date(now.getTime() - DAY_MS) },
    },
    select: { id: true },
  });

  if (!recent) {
    const place = [entry.city, entry.country].filter(Boolean).join(", ") || "lieu inconnu";

    await prisma.supportRequest.create({
      data: {
        userId,
        ipAddress: meta.ipAddress,
        message:
          `Activité suspecte signalée par l'utilisateur : ${entry.event} du ` +
          `${entry.createdAt.toISOString()} (${entry.deviceName ?? "appareil inconnu"}, ${place}). ` +
          "Appareils déconnectés, mot de passe supprimé.",
      },
    });
  }

  await logActivity({
    userId,
    event: "SUSPICIOUS_ACTIVITY_REPORTED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { activityId, passwordCleared: cleared.count === 1, revokedSessions: revoked.length },
  });
  await notifySecurityChange(userId, "SUSPICIOUS_ACTIVITY_REPORTED");

  return {
    message: "Votre compte a été sécurisé. Reconnectez-vous et choisissez un nouveau mot de passe",
    loggedOutDevices: revoked.length,
    passwordCleared: cleared.count === 1,
  };
}

async function exportMyData({ userId, stepUpCode }, meta = {}) {
  const user = await loadActiveUser(userId);

  await consumeStepUp(user, stepUpCode, meta, "account.export");

  const data = await buildUserExport(userId);

  await logActivity({
    userId,
    event: "DATA_EXPORT_REQUESTED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });
  await notifySecurityChange(userId, "DATA_EXPORT_REQUESTED");

  return data;
}

async function buildUserExport(userId) {
  const prisma = getPrisma();
  const now = new Date();
  const since = new Date(now.getTime() - usersConfig.activity.windowMs);

  const [
    account,
    addresses,
    preferences,
    notificationSettings,
    notificationPreferences,
    devices,
    oauthAccounts,
    passkeys,
    activity,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: EXPORT_USER_SELECT }),
    prisma.address.findMany({
      where: { userId },
      select: ADDRESS_SELECT,
      orderBy: { createdAt: "asc" },
    }),
    prisma.userPreferences.findUnique({
      where: { userId },
      select: {
        theme: true,
        dataSaver: true,
        preferredMomoNumber: true,
        reviewNameDisplay: true,
        newOrderSound: true,
      },
    }),
    prisma.notificationSettings.findUnique({
      where: { userId },
      select: {
        timezone: true,
        quietHoursEnabled: true,
        quietHoursStart: true,
        quietHoursEnd: true,
        marketingEmailOptIn: true,
        marketingEmailOptedAt: true,
      },
    }),
    prisma.notificationPreference.findMany({
      where: { userId },
      select: { context: true, channel: true, enabled: true },
    }),
    prisma.session.findMany({
      where: { userId, revokedAt: null, expiresAt: { gt: now } },
      select: {
        deviceName: true,
        platform: true,
        authMethod: true,
        city: true,
        country: true,
        createdAt: true,
        lastSeenAt: true,
      },
    }),
    prisma.oAuthAccount.findMany({
      where: { userId },
      select: { provider: true, email: true, createdAt: true, lastUsedAt: true },
    }),
    prisma.passkey.findMany({
      where: { userId, revokedAt: null },
      select: { name: true, createdAt: true, lastUsedAt: true },
    }),
    prisma.activityLog.findMany({
      where: { userId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      take: EXPORT_ACTIVITY_LIMIT,
      select: {
        event: true,
        success: true,
        method: true,
        deviceName: true,
        platform: true,
        ipAddress: true,
        city: true,
        country: true,
        createdAt: true,
      },
    }),
  ]);

  return {
    generatedAt: now.toISOString(),
    account,
    addresses,
    preferences: preferences ?? PREFERENCE_DEFAULTS,
    notifications: { settings: notificationSettings, preferences: notificationPreferences },
    security: { devices, oauthAccounts, passkeys },
    activity: { windowDays: Math.round(usersConfig.activity.windowMs / DAY_MS), events: activity },
  };
}

module.exports = {
  reportSuspiciousActivity,
  exportMyData,
  buildUserExport,
  avatarPublicId,
  getDeletionOverview,
  requestAccountDeletion,
  purgeAccount,
  purgeDueAccounts,
  getPreferences,
  updatePreferences,
  getProfile,
  updateProfile,
  loadActiveUser,
  toProfile,
  setAvatar,
  removeAvatar,
  listAddresses,
  createAddress,
  updateAddress,
  removeAddress,
  requestContactChange,
  verifyContactChange,
};
