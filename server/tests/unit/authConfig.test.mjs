import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const { authConfig } = require("../../src/features/auth/config/auth.config");

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe("authentication rules from the product document", () => {
  it("allows five devices per account", () => {
    expect(authConfig.maxDevicesPerUser).toBe(5);
  });

  it("logs the team out of the web after 30 minutes without activity", () => {
    expect(authConfig.staffWebIdleTimeoutMs).toBe(30 * MINUTE);
  });

  it("deletes unconfirmed signups after three days", () => {
    expect(authConfig.unconfirmedSignupTtlMs).toBe(3 * DAY);
  });

  it("requires adults only", () => {
    expect(authConfig.minAge).toBe(18);
  });

  it("makes two-step verification mandatory for the team only", () => {
    expect([...authConfig.twoFactorRequiredRoles].sort()).toEqual(["ADMIN", "SUPPORT"]);
    expect([...authConfig.staffRoles].sort()).toEqual(["ADMIN", "SUPPORT"]);
  });

  it("lets buyers, sellers and riders create their own account, nobody else", () => {
    expect([...authConfig.selfSignupRoles].sort()).toEqual(["BUYER", "RIDER", "SELLER"]);
  });

  it("uses the recovery delays of the document", () => {
    expect(authConfig.recovery.primaryContactVetoWindowMs).toBe(24 * HOUR);
    expect(authConfig.recovery.contactActivationDelayMs).toBe(24 * HOUR);
    expect(authConfig.recovery.teamReviewDelayMs).toBe(48 * HOUR);
    expect(authConfig.recovery.payoutLockMs).toBe(72 * HOUR);
  });

  it("keeps a deleted account recoverable for 30 days and the activity log for 90", () => {
    expect(authConfig.deletionGracePeriodMs).toBe(30 * DAY);
    expect(authConfig.activityLogWindowMs).toBe(90 * DAY);
  });

  it("gives ten backup codes and a bounded number of passkeys", () => {
    expect(authConfig.backupCodesCount).toBe(10);
    expect(authConfig.maxPasskeysPerUser).toBeGreaterThan(0);
  });

  it("keeps data only as long as it is useful", () => {
    expect(authConfig.retention.sessionsMs).toBe(30 * DAY);
    expect(authConfig.retention.activityLogsMs).toBeGreaterThanOrEqual(
      authConfig.activityLogWindowMs,
    );
  });

  it("cannot be changed at runtime", () => {
    expect(Object.isFrozen(authConfig)).toBe(true);
    expect(Object.isFrozen(authConfig.recovery)).toBe(true);
    expect(() => {
      "use strict";
      authConfig.maxDevicesPerUser = 99;
    }).toThrow();
  });

  it("asks for a reasonable password length", () => {
    expect(authConfig.password.minLength).toBeGreaterThanOrEqual(8);
    expect(authConfig.password.maxLength).toBeGreaterThan(authConfig.password.minLength);
  });
});
