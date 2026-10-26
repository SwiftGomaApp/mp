const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

const authConfig = Object.freeze({
  maxDevicesPerUser: 5,
  staffWebIdleTimeoutMs: 30 * MINUTE,
  sessionMaxLifetimeMs: 90 * DAY,
  staffSetupTtlMs: 3 * DAY,

  unconfirmedSignupTtlMs: 3 * DAY,
  minAge: 18,

  twoFactorRequiredRoles: Object.freeze(["SUPPORT", "ADMIN"]),
  backupCodesCount: 10,
  maxPasskeysPerUser: 10,

  staffRoles: Object.freeze(["SUPPORT", "ADMIN"]),
  selfSignupRoles: Object.freeze(["BUYER", "SELLER", "RIDER"]),

  password: Object.freeze({ minLength: 8, maxLength: 128 }),

  recovery: Object.freeze({
    contactActivationDelayMs: 24 * HOUR,
    primaryContactVetoWindowMs: 24 * HOUR,
    teamReviewDelayMs: 48 * HOUR,
    payoutLockMs: 72 * HOUR,
    completionWindowMs: 7 * DAY,
  }),

  deletionGracePeriodMs: 30 * DAY,

  activityLogWindowMs: 90 * DAY,

  retention: Object.freeze({
    sessionsMs: 30 * DAY,
    activityLogsMs: 365 * DAY,
    recoveryRequestsMs: 30 * DAY,
  }),

  legal: Object.freeze({ termsVersion: "1.0", privacyVersion: "1.0" }),
});

module.exports = { authConfig };
