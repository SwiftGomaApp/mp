import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loginOtpRequestBody } = require("../src/features/auth/validators/login.validator");
const {
  createStaffBody,
  staffSetupBody,
  resetStaffTwoFactorBody,
} = require("../src/features/auth/validators/staff.validator");
const {
  recoveryRequestBody,
  recoveryCompleteBody,
} = require("../src/features/auth/validators/recovery.validator");
const {
  secondaryContactRemoveBody,
} = require("../src/features/auth/validators/secondary-contact.validator");
const { methodParams } = require("../src/features/auth/validators/methods.validator");
const { supportRequestBody } = require("../src/features/auth/validators/supportRequest.validator");
const { googleLoginBody } = require("../src/features/auth/validators/google.validator");
const { activityQuery } = require("../src/features/auth/validators/security.validator");

const device = { deviceId: "device-12345", platform: "ANDROID" };
const token = "t".repeat(40);

describe("login OTP request", () => {
  it("accepts a phone with an email fallback channel", () => {
    expect(
      loginOtpRequestBody.safeParse({ phone: "+243891234567", channel: "EMAIL" }).success,
    ).toBe(true);
  });

  it("rejects the email channel for an email target", () => {
    expect(
      loginOtpRequestBody.safeParse({ email: "a@example.com", channel: "EMAIL" }).success,
    ).toBe(false);
  });

  it("requires exactly one target", () => {
    expect(loginOtpRequestBody.safeParse({}).success).toBe(false);
    expect(
      loginOtpRequestBody.safeParse({ email: "a@example.com", phone: "+243891234567" }).success,
    ).toBe(false);
  });

  it("refuses non-DRC phone numbers", () => {
    expect(loginOtpRequestBody.safeParse({ phone: "+33612345678" }).success).toBe(false);
  });
});

describe("staff validators", () => {
  it("requires a 6-digit code to create a Support account", () => {
    const body = { name: "Aline Mbula", email: "aline@example.com" };
    expect(createStaffBody.safeParse({ ...body, code: "123456" }).success).toBe(true);
    expect(createStaffBody.safeParse({ ...body, code: "12345" }).success).toBe(false);
    expect(createStaffBody.safeParse(body).success).toBe(false);
  });

  it("requires a reason to reset 2FA", () => {
    expect(resetStaffTwoFactorBody.safeParse({ code: "123456", reason: "abc" }).success).toBe(
      false,
    );
    expect(
      resetStaffTwoFactorBody.safeParse({ code: "123456", reason: "Identité vérifiée" }).success,
    ).toBe(true);
  });

  it("applies the password policy on setup", () => {
    expect(staffSetupBody.safeParse({ token, newPassword: "short1" }).success).toBe(false);
    expect(staffSetupBody.safeParse({ token, newPassword: "longenough1" }).success).toBe(true);
  });
});

describe("recovery validators", () => {
  it("accepts an identifier with an optional contact kind", () => {
    expect(recoveryRequestBody.safeParse({ email: "a@example.com", kind: "PHONE" }).success).toBe(
      true,
    );
    expect(recoveryRequestBody.safeParse({ kind: "PHONE" }).success).toBe(false);
  });

  it("validates the new contact according to its kind", () => {
    const base = { token, code: "123456" };
    expect(
      recoveryCompleteBody.safeParse({ ...base, kind: "PHONE", value: "+243891234567" }).success,
    ).toBe(true);
    expect(
      recoveryCompleteBody.safeParse({ ...base, kind: "PHONE", value: "a@example.com" }).success,
    ).toBe(false);
    expect(
      recoveryCompleteBody.safeParse({ ...base, kind: "EMAIL", value: "a@example.com" }).success,
    ).toBe(true);
  });
});

describe("other auth validators", () => {
  it("accepts only known sign-in methods", () => {
    expect(methodParams.safeParse({ method: "GOOGLE" }).success).toBe(true);
    expect(methodParams.safeParse({ method: "PASSWORD" }).success).toBe(false);
  });

  it("requires a step-up code to remove a recovery contact", () => {
    expect(secondaryContactRemoveBody.safeParse({ kind: "EMAIL" }).success).toBe(false);
    expect(
      secondaryContactRemoveBody.safeParse({ kind: "EMAIL", stepUpCode: "123456" }).success,
    ).toBe(true);
  });

  it("requires a meaningful support message", () => {
    expect(supportRequestBody.safeParse({ email: "a@example.com", message: "court" }).success).toBe(
      false,
    );
    expect(
      supportRequestBody.safeParse({
        email: "a@example.com",
        message: "Mon compte a été suspendu par erreur",
      }).success,
    ).toBe(true);
  });

  it("requires the nonce for Google login", () => {
    expect(googleLoginBody.safeParse({ idToken: "x", device }).success).toBe(false);
    expect(googleLoginBody.safeParse({ idToken: "x", nonce: "n".repeat(32), device }).success).toBe(
      true,
    );
  });

  it("paginates the activity log with defaults", () => {
    const parsed = activityQuery.parse({});
    expect(parsed.page).toBe(1);
    expect(activityQuery.safeParse({ category: "OTHER" }).success).toBe(false);
  });
});
