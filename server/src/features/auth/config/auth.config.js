const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const authConfig = Object.freeze({
  maxDevicesPerUser: 5,
  staffWebIdleTimeoutMs: 30 * MINUTE,

  unconfirmedSignupTtlMs: 3 * DAY,
  minAge: 18,

  riderInviteTtlMs: 7 * DAY,

  twoFactorRequiredRoles: Object.freeze(["SUPPORT", "ADMIN"]),
  backupCodesCount: 10,
  maxPasskeysPerUser: 10,

  staffRoles: Object.freeze(["SUPPORT", "ADMIN"]),
  selfSignupRoles: Object.freeze(["BUYER", "SELLER"]),

  password: Object.freeze({ minLength: 8, maxLength: 128 }),

  recovery: Object.freeze({
    contactActivationDelayMs: 24 * HOUR,
    primaryContactVetoWindowMs: 24 * HOUR,
    teamReviewDelayMs: 48 * HOUR,
    payoutLockMs: 72 * HOUR,
  }),

  deletionGracePeriodMs: 30 * DAY,

  activityLogWindowMs: 90 * DAY,

  legal: Object.freeze({ termsVersion: "1.0", privacyVersion: "1.0" }),
});

module.exports = { authConfig };
