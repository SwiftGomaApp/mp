const { getPrisma } = require("../../../core/db/prisma");
const { getRedis } = require("../../../core/cache/redis");
const { AppError } = require("../../../core/errors/AppError");
const { issueOtp, verifyOtp, OTP_PURPOSES } = require("../../../core/auth/otp");
const { queueOtpEmail, queueOtpSms } = require("../../../core/queue/notifications");
const { logActivity } = require("./activity.service");

const PENDING_TTL_SECONDS = 10 * 60;

const CONTACTS = {
  EMAIL: {
    field: "secondaryEmail",
    verifiedField: "secondaryEmailVerifiedAt",
    event: "SECONDARY_EMAIL_ADDED",
  },
  PHONE: {
    field: "secondaryPhone",
    verifiedField: "secondaryPhoneVerifiedAt",
    event: "SECONDARY_PHONE_ADDED",
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

async function loadActiveUser(userId) {
  const user = await getPrisma().user.findUnique({
    where: { id: userId },
  });

  if (!user || user.status !== "ACTIVE") {
    throw AppError.unauthorized("Session expirée, veuillez vous reconnecter", "SESSION_REVOKED");
  }

  return user;
}

async function assertContactAvailable(contact, userId) {
  const existingUser = await getPrisma().user.findFirst({
    where: {
      id: { not: userId },
      OR: [
        { email: contact },
        { phone: contact },
        { secondaryEmail: contact },
        { secondaryPhone: contact },
      ],
    },
    select: { id: true },
  });

  if (existingUser) {
    throw AppError.conflict(
      "Cet e-mail ou ce numéro est déjà associé à un autre compte",
      "CONTACT_ALREADY_IN_USE",
    );
  }
}

function getMeta(meta = {}) {
  return {
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  };
}

async function requestSecondaryContactOtp({ userId, kind, value }, meta = {}) {
  const config = getContactConfig(kind);
  const user = await loadActiveUser(userId);
  const contact = normalizeContact(kind, value);

  if (user[config.field]) {
    throw AppError.conflict(
      "Un contact secondaire de ce type est déjà enregistré",
      "SECONDARY_CONTACT_ALREADY_SET",
    );
  }

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

  await loadActiveUser(userId);

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
      where: {
        id: userId,
        status: "ACTIVE",
        [config.field]: null,
      },
      data: {
        [config.field]: contact,
        [config.verifiedField]: new Date(),
      },
    });

    if (result.count !== 1) {
      throw AppError.conflict(
        "Un contact secondaire de ce type est déjà enregistré",
        "SECONDARY_CONTACT_ALREADY_SET",
      );
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
    ...getMeta(meta),
    target: contact,
    metadata: {
      action: `secondary_contact.${kind.toLowerCase()}.verified`,
    },
  });

  return {
    message: "Contact secondaire vérifié avec succès",
    kind,
    contact,
    verified: true,
  };
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
  listSecondaryContacts,
};
