const DAY = 24 * 60 * 60 * 1000;
const MB = 1024 * 1024;

const COMMON_DOCUMENTS = ["ID_CARD", "SELFIE", "PROOF_OF_ADDRESS"];

const verificationConfig = Object.freeze({
  maxAttempts: 3,
  expiryReminderMs: 30 * DAY,

  file: Object.freeze({
    maxBytes: 5 * MB,
    imageMimeTypes: Object.freeze(["image/jpeg", "image/png", "image/webp"]),
    documentMimeTypes: Object.freeze(["image/jpeg", "image/png", "image/webp", "application/pdf"]),
    imageOnly: Object.freeze(["SELFIE", "SHOP_PHOTO", "VEHICLE_PHOTO"]),
  }),

  documents: Object.freeze({
    SELLER: Object.freeze({
      required: Object.freeze([...COMMON_DOCUMENTS, "SHOP_PHOTO"]),
      optional: Object.freeze(["RCCM"]),
    }),
    RIDER: Object.freeze({
      required: Object.freeze([
        ...COMMON_DOCUMENTS,
        "DRIVING_LICENCE",
        "VEHICLE_PHOTO",
        "VEHICLE_DOCUMENT",
        "VEHICLE_INSURANCE",
      ]),
      optional: Object.freeze([]),
    }),
  }),

  expiryRequired: Object.freeze(["DRIVING_LICENCE", "VEHICLE_DOCUMENT", "VEHICLE_INSURANCE"]),

  taxNumber: Object.freeze({ minLength: 3, maxLength: 40 }),
  plate: Object.freeze({ minLength: 4, maxLength: 12 }),

  signedUrlTtlSeconds: 120,

  reviewerRoles: Object.freeze(["SUPPORT", "ADMIN"]),
  deciderRoles: Object.freeze(["ADMIN"]),

  transitions: Object.freeze({
    PENDING: Object.freeze(["IN_REVIEW"]),
    IN_REVIEW: Object.freeze(["APPROVED", "REJECTED"]),
    APPROVED: Object.freeze([]),
    REJECTED: Object.freeze([]),
  }),
});

module.exports = { verificationConfig };
