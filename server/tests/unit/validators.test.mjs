import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const signup = require("../../src/features/auth/validators/signup.validator");
const password = require("../../src/features/auth/validators/password.validator");
const passkey = require("../../src/features/auth/validators/passkey.validator");
const apple = require("../../src/features/auth/validators/apple.validator");
const google = require("../../src/features/auth/validators/google.validator");
const session = require("../../src/features/auth/validators/session.validator");
const totp = require("../../src/features/auth/validators/totp.validator");
const methods = require("../../src/features/auth/validators/methods.validator");
const { email, drcPhone, uuid, idParams, pagination } = require("../../src/core/validation/common");

const device = { deviceId: "device-12345", platform: "IOS" };
const nonce = "n".repeat(40);
const ok = (schema, value) => schema.safeParse(value).success;

describe("device", () => {
  it("needs an id of 8 to 128 characters and a known platform", () => {
    expect(ok(signup.device, device)).toBe(true);
    expect(ok(signup.device, { ...device, deviceId: "short" })).toBe(false);
    expect(ok(signup.device, { ...device, deviceId: "x".repeat(129) })).toBe(false);
    expect(ok(signup.device, { ...device, platform: "WINDOWS" })).toBe(false);
    expect(ok(signup.device, { ...device, deviceName: "x".repeat(101) })).toBe(false);
  });
});

describe("signup", () => {
  const person = { name: "Alice", role: "BUYER", acceptTerms: true, confirmAge: true };

  it("accepts the three self-service roles and nothing else", () => {
    for (const role of ["BUYER", "SELLER", "RIDER"]) {
      expect(ok(signup.signupEmailBody, { ...person, role, email: "a@example.com" })).toBe(true);
    }
    for (const role of ["ADMIN", "SUPPORT", "buyer", ""]) {
      expect(ok(signup.signupEmailBody, { ...person, role, email: "a@example.com" })).toBe(false);
    }
  });

  it("requires the terms and the age confirmation to be exactly true", () => {
    for (const field of ["acceptTerms", "confirmAge"]) {
      for (const value of [false, "true", 1, undefined]) {
        expect(
          ok(signup.signupEmailBody, { ...person, email: "a@example.com", [field]: value }),
        ).toBe(false);
      }
    }
  });

  it("trims and lowercases the email and bounds the name", () => {
    const parsed = signup.signupEmailBody.parse({ ...person, email: "  A@Example.COM " });
    expect(parsed.email).toBe("a@example.com");
    expect(ok(signup.signupEmailBody, { ...person, name: "A", email: "a@example.com" })).toBe(
      false,
    );
    expect(
      ok(signup.signupEmailBody, { ...person, name: "x".repeat(101), email: "a@example.com" }),
    ).toBe(false);
  });

  it("only takes phone numbers from the DRC", () => {
    expect(ok(signup.signupPhoneBody, { ...person, phone: "+243891234567" })).toBe(true);
    for (const phone of [
      "+33612345678",
      "0891234567",
      "+24389123456",
      "+2438912345678",
      "243891234567",
    ]) {
      expect(ok(signup.signupPhoneBody, { ...person, phone })).toBe(false);
    }
  });

  it("needs exactly one target and a six-digit code to confirm", () => {
    const base = { code: "123456", device };
    expect(ok(signup.verifySignupBody, { ...base, email: "a@example.com" })).toBe(true);
    expect(ok(signup.verifySignupBody, { ...base, phone: "+243891234567" })).toBe(true);
    expect(ok(signup.verifySignupBody, base)).toBe(false);
    expect(
      ok(signup.verifySignupBody, { ...base, email: "a@example.com", phone: "+243891234567" }),
    ).toBe(false);
    for (const code of ["12345", "1234567", "12345a", ""]) {
      expect(ok(signup.verifySignupBody, { ...base, email: "a@example.com", code })).toBe(false);
    }
  });

  it("needs exactly one target to resend", () => {
    expect(ok(signup.resendSignupBody, { email: "a@example.com" })).toBe(true);
    expect(ok(signup.resendSignupBody, {})).toBe(false);
  });
});

describe("passwords", () => {
  const strong = "Secret123";

  it.each([
    ["too short", "Ab1"],
    ["no digit", "OnlyLetters"],
    ["no letter", "12345678"],
    ["too long", `A1${"x".repeat(200)}`],
  ])("rejects a password that is %s", (_, value) => {
    expect(ok(password.createPasswordBody, { password: value, code: "123456" })).toBe(false);
  });

  it("accepts a reasonable password and keeps spaces in it", () => {
    expect(ok(password.createPasswordBody, { password: strong, code: "123456" })).toBe(true);
    expect(password.newPassword.parse(" Secret 123 ")).toBe(" Secret 123 ");
  });

  it("needs the current password, a new one and a code to change it", () => {
    const body = { currentPassword: "Old12345", newPassword: strong, code: "123456" };
    expect(ok(password.updatePasswordBody, body)).toBe(true);
    expect(ok(password.updatePasswordBody, { ...body, currentPassword: "" })).toBe(false);
    expect(ok(password.updatePasswordBody, { ...body, code: "abc" })).toBe(false);
  });

  it("validates the forgot, reset and login forms", () => {
    expect(ok(password.forgotPasswordBody, { email: "a@example.com" })).toBe(true);
    expect(ok(password.forgotPasswordBody, { email: "not-an-email" })).toBe(false);
    expect(
      ok(password.resetPasswordBody, {
        email: "a@example.com",
        code: "123456",
        newPassword: strong,
      }),
    ).toBe(true);
    expect(
      ok(password.resetPasswordBody, {
        email: "a@example.com",
        code: "123456",
        newPassword: "weak",
      }),
    ).toBe(false);
    expect(ok(password.loginPasswordBody, { email: "a@example.com", password: "x", device })).toBe(
      true,
    );
    expect(ok(password.loginPasswordBody, { email: "a@example.com", password: "", device })).toBe(
      false,
    );
  });

  it("lets the step-up request pick a channel", () => {
    expect(ok(password.passwordOtpRequestBody, {})).toBe(true);
    expect(ok(password.passwordOtpRequestBody, { channel: "PHONE" })).toBe(true);
    expect(ok(password.passwordOtpRequestBody, { channel: "FAX" })).toBe(false);
  });
});

describe("two-step verification", () => {
  it("takes an app code or a backup code, never both and never neither", () => {
    expect(ok(totp.factorBody, { code: "123456" })).toBe(true);
    expect(ok(totp.factorBody, { backupCode: "ABCDE-FGHJK" })).toBe(true);
    expect(ok(totp.factorBody, {})).toBe(false);
    expect(ok(totp.factorBody, { code: "123456", backupCode: "ABCDE-FGHJK" })).toBe(false);
  });

  it("needs a challenge token for the login and enrollment steps", () => {
    const challengeToken = "c".repeat(43);
    expect(ok(totp.loginChallengeBody, { challengeToken, code: "123456" })).toBe(true);
    expect(ok(totp.loginChallengeBody, { code: "123456" })).toBe(false);
    expect(ok(totp.enrollSetupBody, { challengeToken })).toBe(true);
    expect(ok(totp.enrollConfirmBody, { challengeToken, code: "123456" })).toBe(true);
    expect(ok(totp.confirmBody, { code: "123456", stepUpCode: "654321" })).toBe(true);
    expect(ok(totp.confirmBody, { code: "123456" })).toBe(false);
  });
});

describe("passkeys", () => {
  const response = { id: "abc", rawId: "abc", type: "public-key", response: { any: "thing" } };

  it("accepts a WebAuthn credential and keeps unknown fields", () => {
    const parsed = passkey.registerPasskeyBody.parse({
      response: { ...response, extra: 1 },
      stepUpCode: "123456",
    });
    expect(parsed.response.extra).toBe(1);
  });

  it("rejects credentials of another type or without an id", () => {
    expect(
      ok(passkey.registerPasskeyBody, {
        response: { ...response, type: "password" },
        stepUpCode: "123456",
      }),
    ).toBe(false);
    expect(
      ok(passkey.registerPasskeyBody, { response: { ...response, id: "" }, stepUpCode: "123456" }),
    ).toBe(false);
    expect(ok(passkey.registerPasskeyBody, { response, stepUpCode: "12" })).toBe(false);
  });

  it("limits the name and requires a challenge to sign in", () => {
    expect(ok(passkey.renamePasskeyBody, { name: "Mon téléphone" })).toBe(true);
    expect(ok(passkey.renamePasskeyBody, { name: "" })).toBe(false);
    expect(ok(passkey.renamePasskeyBody, { name: "x".repeat(61) })).toBe(false);
    expect(ok(passkey.loginPasskeyBody, { challengeId: "c".repeat(43), response, device })).toBe(
      true,
    );
    expect(ok(passkey.loginPasskeyBody, { challengeId: "short", response, device })).toBe(false);
  });
});

describe("Google and Apple", () => {
  const signupFields = {
    idToken: "token",
    nonce,
    role: "BUYER",
    acceptTerms: true,
    confirmAge: true,
    device,
  };

  it("both require the nonce for login and signup", () => {
    for (const [login, signupBody] of [
      [google.googleLoginBody, google.googleSignupBody],
      [apple.appleLoginBody, apple.appleSignupBody],
    ]) {
      expect(ok(login, { idToken: "token", nonce, device })).toBe(true);
      expect(ok(login, { idToken: "token", device })).toBe(false);
      expect(ok(login, { idToken: "token", nonce: "short", device })).toBe(false);
      expect(ok(signupBody, signupFields)).toBe(true);
      expect(ok(signupBody, { ...signupFields, nonce: undefined })).toBe(false);
      expect(ok(signupBody, { ...signupFields, role: "ADMIN" })).toBe(false);
      expect(ok(signupBody, { ...signupFields, acceptTerms: false })).toBe(false);
    }
  });

  it("needs a token and a fresh code to link", () => {
    expect(ok(google.googleLinkBody, { idToken: "token", stepUpCode: "123456" })).toBe(true);
    expect(ok(google.googleLinkBody, { idToken: "token" })).toBe(false);
    expect(ok(apple.appleLinkBody, { idToken: "token", nonce, stepUpCode: "123456" })).toBe(true);
    expect(ok(apple.appleLinkBody, { idToken: "token", stepUpCode: "123456" })).toBe(false);
    expect(ok(google.googleLoginBody, { idToken: "", nonce, device })).toBe(false);
  });
});

describe("shared validators", () => {
  it("allows the refresh token in the body or not at all", () => {
    expect(ok(session.refreshBody, {})).toBe(true);
    expect(ok(session.refreshBody, { refreshToken: "r".repeat(64) })).toBe(true);
    expect(ok(session.refreshBody, { refreshToken: "short" })).toBe(false);
  });

  it("knows which sign-in methods can be removed from the methods screen", () => {
    for (const method of ["EMAIL", "PHONE", "GOOGLE", "APPLE"]) {
      expect(ok(methods.methodParams, { method })).toBe(true);
    }
    expect(ok(methods.methodParams, { method: "PASSWORD" })).toBe(false);
    expect(ok(methods.methodParams, { method: "PASSKEY" })).toBe(false);
  });

  it("normalises emails and validates ids and pagination", () => {
    expect(email.parse(" A@B.CO ")).toBe("a@b.co");
    expect(ok(email, "nope")).toBe(false);
    expect(ok(drcPhone, "+243891234567")).toBe(true);
    expect(ok(uuid, "not-a-uuid")).toBe(false);
    expect(ok(idParams, { id: "123e4567-e89b-42d3-a456-426614174000" })).toBe(true);
    expect(pagination.parse({})).toEqual({ page: 1, limit: 20 });
    expect(pagination.parse({ page: "3", limit: "50" })).toEqual({ page: 3, limit: 50 });
    expect(ok(pagination, { limit: 101 })).toBe(false);
    expect(ok(pagination, { page: 0 })).toBe(false);
  });
});
