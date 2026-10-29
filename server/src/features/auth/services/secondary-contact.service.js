const { getPrisma } = require("../../../core/db/prisma");
const { getRedis } = require("../../../core/cache/redis");
const { AppError } = require("../../../core/errors/AppError");
const { issueOtp, verifyOtp, OTP_PURPOSES } = require("../../../core/auth/otp");
const { queueOtpEmail, queueOtpSms } = require("../../../core/queue/notifications");
const { logActivity } = require("./activity.service");
const { consumeStepUp, loadActiveUser } = require("./stepUp.service");
const { notifySecurityChange } = require("./securityNotice.service");

const PENDING_TTL_SECONDS = 10 * 60;

const CONTACTS = {
  EMAIL: {
    field: "secondaryEmail",
    verifiedField: "secondaryEmailVerifiedAt",
    addedEvent: "SECONDARY_EMAIL_ADDED",
    changedEvent: "SECONDARY_EMAIL_CHANGED",
    removedEvent: "SECONDARY_EMAIL_REMOVED",
  },
  PHONE: {
    field: "secondaryPhone",
    verifiedField: "secondaryPhoneVerifiedAt",
    addedEvent: "SECONDARY_PHONE_ADDED",
    changedEvent: "SECONDARY_PHONE_CHANGED",
    removedEvent: "SECONDARY_PHONE_REMOVED",
  },
};

function pendingKey(userId, kind) {
  return `secondary-contact:pending:${userId}:${kind.toLowerCase()}`;
}

function otpPurpose(userId, kind) {
  return `${OTP_PURPOSES.STEP_UP}:secondary-contact:${kind.toLowerCase()}:${userId}`;
}

function normalizeContact(kind, value) {
  const contact = String(value).trim();

  return kind === "EMAIL" ? contact.toLowerCase() : contact;
}

function getContactConfig(kind) {
  const config = CONTACTS[kind];

  if (!config) {
    throw AppError.badRequest("Type de contact invalide", undefined, "INVALID_CONTACT_TYPE");
  }

  return config;
}

async function assertContactAvailable(contact, userId) {
  const existing = await getPrisma().user.findFirst({
    where: {
      OR: [
        { email: contact },
        { phone: contact },
        { secondaryEmail: contact, id: { not: userId } },
        { secondaryPhone: contact, id: { not: userId } },
      ],
    },
    select: { id: true },
  });

  if (!existing) return;

  if (existing.id === userId) {
    throw AppError.conflict(
      "Le contact de récupération doit être différent de vos contacts principaux",
      "CONTACT_SAME_AS_PRIMARY",
    );
  }

  throw AppError.conflict(
    "Cet e-mail ou ce numéro est déjà associé à un autre compte",
    "CONTACT_ALREADY_IN_USE",
  );
}

function getMeta(meta = {}) {
  return {
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  };
}

async function requestSecondaryContactOtp({ userId, kind, value, stepUpCode }, meta = {}) {
  const config = getContactConfig(kind);
  const user = await loadActiveUser(userId);
  const contact = normalizeContact(kind, value);

  if (user[config.field] === contact) {
    throw AppError.conflict(
      "Ce contact de récupération est déjà enregistré",
      "SECONDARY_CONTACT_UNCHANGED",
    );
  }

  await consumeStepUp(user, stepUpCode, meta, `secondary_contact.${kind.toLowerCase()}`);

  await assertContactAvailable(contact, userId);

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
    await queueOtpSms({
      to: contact,
      code,
      expiresMinutes,
    });
  }

  await logActivity({
    userId,
    event: "OTP_REQUESTED",
    method: kind === "EMAIL" ? "EMAIL_OTP" : "PHONE_OTP",
    ...getMeta(meta),
    metadata: {
      purpose: OTP_PURPOSES.STEP_UP,
      action: `secondary_contact.${kind.toLowerCase()}.request`,
    },
  });

  return {
    message: "Un code de vérification a été envoyé",
    kind,
    contact,
    expiresMinutes,
  };
}

async function verifySecondaryContact({ userId, kind, value, code }, meta = {}) {
  const config = getContactConfig(kind);
  const contact = normalizeContact(kind, value);
  const redis = getRedis();

  const user = await loadActiveUser(userId);
  const previous = user[config.field];

  const storedContact = await redis.get(pendingKey(userId, kind));

  if (!storedContact || storedContact !== contact) {
    throw AppError.badRequest(
      "Demande de vérification invalide ou expirée",
      undefined,
      "SECONDARY_CONTACT_REQUEST_EXPIRED",
    );
  }

  await assertContactAvailable(contact, userId);

  await verifyOtp({
    purpose: otpPurpose(userId, kind),
    target: contact,
    code,
  });

  try {
    const result = await getPrisma().user.updateMany({
      where: { id: userId, status: "ACTIVE" },
      data: {
        [config.field]: contact,
        [config.verifiedField]: new Date(),
      },
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
    event: previous ? config.changedEvent : config.addedEvent,
    method: kind === "EMAIL" ? "EMAIL_OTP" : "PHONE_OTP",
    ...getMeta(meta),
    target: contact,
    metadata: {
      action: `secondary_contact.${kind.toLowerCase()}.verified`,
    },
  });

  await notifySecurityChange(
    userId,
    previous ? "SECONDARY_CONTACT_CHANGED" : "SECONDARY_CONTACT_ADDED",
  );

  return {
    message: "Contact de récupération vérifié avec succès",
    kind,
    contact,
    verified: true,
  };
}

async function removeSecondaryContact({ userId, kind, stepUpCode }, meta = {}) {
  const config = getContactConfig(kind);
  const user = await loadActiveUser(userId);

  if (!user[config.field]) {
    throw AppError.notFound(
      "Aucun contact de récupération de ce type n'est enregistré",
      "SECONDARY_CONTACT_NOT_FOUND",
    );
  }

  await consumeStepUp(user, stepUpCode, meta, `secondary_contact.${kind.toLowerCase()}.remove`);

  await getPrisma().user.update({
    where: { id: userId },
    data: { [config.field]: null, [config.verifiedField]: null },
  });
  await getRedis().del(pendingKey(userId, kind));

  await logActivity({
    userId,
    event: config.removedEvent,
    ...getMeta(meta),
    metadata: { action: `secondary_contact.${kind.toLowerCase()}.removed` },
  });
  await notifySecurityChange(userId, "SECONDARY_CONTACT_REMOVED");

  return listSecondaryContacts(userId);
}

async function listSecondaryContacts(userId) {
  const user = await loadActiveUser(userId);

  return {
    secondaryEmail: user.secondaryEmail,
    secondaryEmailVerifiedAt: user.secondaryEmailVerifiedAt,
    secondaryPhone: user.secondaryPhone,
    secondaryPhoneVerifiedAt: user.secondaryPhoneVerifiedAt,
  };
}

module.exports = {
  requestSecondaryContactOtp,
  verifySecondaryContact,
  removeSecondaryContact,
  listSecondaryContacts,
};
