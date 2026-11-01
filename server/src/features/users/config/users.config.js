const { authConfig } = require("../../auth/config/auth.config");

const MB = 1024 * 1024;

const usersConfig = Object.freeze({
  profile: Object.freeze({
    name: Object.freeze({ minLength: 2, maxLength: 80 }),
  }),

  avatar: Object.freeze({
    maxBytes: 2 * MB,
    allowedMimeTypes: Object.freeze(["image/jpeg", "image/png", "image/webp"]),
  }),

  addresses: Object.freeze({
    allowedRoles: Object.freeze(["BUYER"]),
    maxPerUser: 10,
    defaultCity: "Goma",
    label: Object.freeze({ minLength: 1, maxLength: 40 }),
    recipientName: Object.freeze({ maxLength: 80 }),
    line1: Object.freeze({ minLength: 3, maxLength: 160 }),
    quartier: Object.freeze({ maxLength: 80 }),
    commune: Object.freeze({ maxLength: 80 }),
    landmark: Object.freeze({ maxLength: 160 }),
  }),

  preferences: Object.freeze({
    themes: Object.freeze(["LIGHT", "DARK", "SYSTEM"]),
    reviewNameDisplays: Object.freeze(["FULL_NAME", "FIRST_NAME_INITIAL", "ANONYMOUS"]),
    newOrderSounds: Object.freeze(["default", "bell", "chime", "alert"]),
    sellerOnlyKeys: Object.freeze(["newOrderSound"]),
    buyerOnlyKeys: Object.freeze(["preferredMomoNumber", "reviewNameDisplay"]),
  }),

  activity: Object.freeze({
    windowMs: authConfig.activityLogWindowMs,
    defaultPageSize: 20,
    maxPageSize: 50,
  }),

  deletion: Object.freeze({
    gracePeriodMs: authConfig.deletionGracePeriodMs,
    confirmationWord: "SUPPRIMER",
    blockedStatuses: Object.freeze(["SUSPENDED", "BANNED", "DELETED"]),
    staffRolesExcluded: authConfig.staffRoles,
  }),
});

module.exports = { usersConfig };
