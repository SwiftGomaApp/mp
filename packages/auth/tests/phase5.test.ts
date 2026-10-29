import { describe, expect, it } from "vitest";
import { NotAuthenticatedError, TooManyRequestsError } from "../src/index";
import { USER, fail, makeAuth, ok, savedPhoneSession } from "./helpers";
import type { Reply } from "./helpers";

const CHALLENGE = "c".repeat(40);

const needsSecondStep = (extra: object = {}): Reply => ({
  status: 202,
  data: { twoFactorRequired: true, challengeToken: CHALLENGE, expiresIn: 300, ...extra },
});

const phoneSession = (extra: object = {}): Reply =>
  ok({
    user: USER,
    accessToken: "access-1",
    refreshToken: "refresh-1",
    isNewDevice: false,
    ...extra,
  });

describe("two-step verification at sign-in", () => {
  it("finishes the sign-in with an app code, using the token kept from the first step", async () => {
    const { auth, calls } = makeAuth("ANDROID", (seen) =>
      seen.url === "/auth/login/password" ? needsSecondStep() : phoneSession(),
    );
    await auth.login.password({ email: "gael@example.com", password: "secret123" });
    const result = await auth.twoFactor.verify({ code: "123456" });

    expect(result).toEqual({ user: USER, isNewDevice: false });
    expect(calls[1]).toMatchObject({ method: "post", url: "/auth/2fa/verify" });
    expect(calls[1]?.body).toEqual({ challengeToken: CHALLENGE, code: "123456" });
    expect(auth.session.getState().status).toBe("authenticated");
    expect(await auth.session.getAccessToken()).toBe("access-1");
  });

  it("accepts a backup code", async () => {
    const { auth, calls } = makeAuth("ANDROID", (seen) =>
      seen.url === "/auth/login/otp/verify" ? needsSecondStep() : phoneSession(),
    );
    await auth.login.emailCode.verify({ email: "gael@example.com", code: "123456" });
    await auth.twoFactor.verify({ backupCode: "ABCD-EFGH" });
    expect(calls[1]?.body).toEqual({ challengeToken: CHALLENGE, backupCode: "ABCD-EFGH" });
  });

  it("signs a browser in without tokens", async () => {
    const { auth } = makeAuth("WEB", (seen) =>
      seen.url === "/auth/login/password"
        ? needsSecondStep()
        : ok({ user: USER, isNewDevice: true }),
    );
    await auth.login.password({ email: "gael@example.com", password: "secret123" });
    expect(await auth.twoFactor.verify({ code: "123456" })).toEqual({
      user: USER,
      isNewDevice: true,
    });
    expect(await auth.session.getAccessToken()).toBeNull();
  });

  it("lets the user try again after a wrong code", async () => {
    let attempts = 0;
    const { auth, calls } = makeAuth("ANDROID", (seen) => {
      if (seen.url === "/auth/login/password") return needsSecondStep();
      attempts += 1;
      return attempts === 1 ? fail(400, "TWO_FACTOR_INVALID") : phoneSession();
    });
    await auth.login.password({ email: "gael@example.com", password: "secret123" });

    await expect(auth.twoFactor.verify({ code: "000000" })).rejects.toMatchObject({
      code: "TWO_FACTOR_INVALID",
    });
    await auth.twoFactor.verify({ code: "123456" });
    expect(calls.filter((c) => c.url === "/auth/2fa/verify")).toHaveLength(2);
    expect(auth.session.getState().status).toBe("authenticated");
  });

  it("forgets the token when the server says the sign-in ran out", async () => {
    const { auth, calls } = makeAuth("ANDROID", (seen) =>
      seen.url === "/auth/login/password"
        ? needsSecondStep()
        : fail(401, "TWO_FACTOR_CHALLENGE_EXPIRED"),
    );
    await auth.login.password({ email: "gael@example.com", password: "secret123" });
    await expect(auth.twoFactor.verify({ code: "123456" })).rejects.toMatchObject({
      code: "TWO_FACTOR_CHALLENGE_EXPIRED",
    });
    await expect(auth.twoFactor.verify({ code: "123456" })).rejects.toBeInstanceOf(
      NotAuthenticatedError,
    );
    expect(calls.filter((c) => c.url === "/auth/2fa/verify")).toHaveLength(1);
  });

  it("does not call the server when there is no sign-in waiting", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => phoneSession());
    await expect(auth.twoFactor.verify({ code: "123456" })).rejects.toBeInstanceOf(
      NotAuthenticatedError,
    );
    expect(calls).toHaveLength(0);
  });

  it("reports a lock-out as too many requests", async () => {
    const { auth } = makeAuth("ANDROID", (seen) =>
      seen.url === "/auth/login/password" ? needsSecondStep() : fail(429, "TWO_FACTOR_LOCKED"),
    );
    await auth.login.password({ email: "gael@example.com", password: "secret123" });
    await expect(auth.twoFactor.verify({ code: "123456" })).rejects.toBeInstanceOf(
      TooManyRequestsError,
    );
  });
});

describe("first-time two-step enrollment", () => {
  const staff = (seen: { url: string }): Reply => {
    if (seen.url === "/auth/login/password") return needsSecondStep({ enrollment: true });
    if (seen.url === "/auth/2fa/enroll/setup") {
      return ok({ secret: "JBSWY3DPEHPK3PXP", otpauthUri: "otpauth://totp/SwiftGoma:gael" });
    }
    return phoneSession({ backupCodes: ["AAAA-1111", "BBBB-2222"], isNewDevice: true });
  };

  it("gives the secret, then signs in with the first code and returns the backup codes", async () => {
    const { auth, calls } = makeAuth("ANDROID", staff);
    const first = await auth.login.password({ email: "staff@example.com", password: "secret123" });
    expect(first.status).toBe("twoFactorEnrollmentRequired");

    const setup = await auth.twoFactor.enroll.start();
    expect(setup).toEqual({
      secret: "JBSWY3DPEHPK3PXP",
      otpauthUri: "otpauth://totp/SwiftGoma:gael",
    });
    expect(calls[1]?.body).toEqual({ challengeToken: CHALLENGE });

    const done = await auth.twoFactor.enroll.confirm({ code: "123456" });
    expect(done).toEqual({
      user: USER,
      isNewDevice: true,
      backupCodes: ["AAAA-1111", "BBBB-2222"],
    });
    expect(calls[2]?.body).toEqual({ challengeToken: CHALLENGE, code: "123456" });
    expect(auth.session.getState().status).toBe("authenticated");
  });

  it("needs a sign-in in progress", async () => {
    const { auth, calls } = makeAuth("ANDROID", staff);
    await expect(auth.twoFactor.enroll.start()).rejects.toBeInstanceOf(NotAuthenticatedError);
    await expect(auth.twoFactor.enroll.confirm({ code: "123456" })).rejects.toBeInstanceOf(
      NotAuthenticatedError,
    );
    expect(calls).toHaveLength(0);
  });

  it("refuses a setup answer without a secret", async () => {
    const { auth } = makeAuth("ANDROID", (seen) =>
      seen.url === "/auth/login/password" ? needsSecondStep({ enrollment: true }) : ok({}),
    );
    await auth.login.password({ email: "staff@example.com", password: "secret123" });
    await expect(auth.twoFactor.enroll.start()).rejects.toMatchObject({ code: "UNKNOWN_ERROR" });
  });
});

describe("step-up codes", () => {
  const signedIn = () => savedPhoneSession(Date.now() + 600_000);

  it("asks for a code and says where it went", async () => {
    const { auth, calls } = makeAuth(
      "ANDROID",
      () => ok({ channel: "EMAIL", target: "gael@example.com", expiresMinutes: 10 }),
      signedIn(),
    );
    await auth.start();
    const sent = await auth.stepUp.request();

    expect(sent).toEqual({ channel: "EMAIL", target: "gael@example.com", expiresMinutes: 10 });
    expect(calls[0]).toMatchObject({
      method: "post",
      url: "/auth/step-up/otp",
      auth: "Bearer access-1",
    });
    expect(calls[0]?.body).toEqual({});
    auth.stop();
  });

  it("can ask for a given channel", async () => {
    const { auth, calls } = makeAuth(
      "ANDROID",
      () => ok({ channel: "PHONE", target: "+243990000000", expiresMinutes: 10 }),
      signedIn(),
    );
    await auth.start();
    await auth.stepUp.request({ channel: "PHONE" });
    expect(calls[0]?.body).toEqual({ channel: "PHONE" });
    auth.stop();
  });

  it("reports an account with no verified contact", async () => {
    const { auth } = makeAuth("ANDROID", () => fail(400, "CONTACT_NOT_AVAILABLE"), signedIn());
    await auth.start();
    await expect(auth.stepUp.request()).rejects.toMatchObject({ code: "CONTACT_NOT_AVAILABLE" });
    auth.stop();
  });

  it("reports a rate limit with its delay", async () => {
    const { auth } = makeAuth(
      "ANDROID",
      () => fail(429, "OTP_COOLDOWN", { details: { retryAfterSeconds: 42 } }),
      signedIn(),
    );
    await auth.start();
    const error = await auth.stepUp.request().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(TooManyRequestsError);
    expect((error as TooManyRequestsError).retryAfterSeconds).toBe(42);
    auth.stop();
  });
});

describe("password", () => {
  const signedIn = () => savedPhoneSession(Date.now() + 600_000);
  const message = (text: string): Reply => ok({ message: text });

  it("creates a password with a step-up code", async () => {
    const { auth, calls } = makeAuth(
      "ANDROID",
      () => ({ status: 201, data: { message: "Mot de passe créé" } }),
      signedIn(),
    );
    await auth.start();
    expect(await auth.password.create({ password: "secret123", code: "123456" })).toEqual({
      message: "Mot de passe créé",
    });
    expect(calls[0]).toMatchObject({ method: "post", url: "/auth/password" });
    expect(calls[0]?.body).toEqual({ password: "secret123", code: "123456" });
    auth.stop();
  });

  it("changes the password", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => message("Mot de passe modifié"), signedIn());
    await auth.start();
    await auth.password.change({
      currentPassword: "old12345",
      newPassword: "new12345",
      code: "123456",
    });
    expect(calls[0]).toMatchObject({ method: "put", url: "/auth/password" });
    expect(calls[0]?.body).toEqual({
      currentPassword: "old12345",
      newPassword: "new12345",
      code: "123456",
    });
    auth.stop();
  });

  it("removes the password", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => message("Mot de passe supprimé"), signedIn());
    await auth.start();
    await auth.password.remove({ code: "123456" });
    expect(calls[0]).toMatchObject({ method: "post", url: "/auth/password/remove" });
    auth.stop();
  });

  it("starts a reset without being signed in", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => message("Si un compte existe..."));
    expect(await auth.password.forgot({ email: "gael@example.com" })).toEqual({
      message: "Si un compte existe...",
    });
    expect(calls[0]).toMatchObject({ url: "/auth/password/forgot", auth: undefined });
  });

  it("finishes a reset", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => message("Mot de passe réinitialisé"));
    await auth.password.reset({
      email: "gael@example.com",
      code: "123456",
      newPassword: "new12345",
    });
    expect(calls[0]).toMatchObject({ url: "/auth/password/reset" });
    expect(calls[0]?.body).toEqual({
      email: "gael@example.com",
      code: "123456",
      newPassword: "new12345",
    });
  });

  it("passes the server errors through", async () => {
    const { auth } = makeAuth("ANDROID", () => fail(400, "INVALID_CURRENT_PASSWORD"), signedIn());
    await auth.start();
    await expect(
      auth.password.change({ currentPassword: "bad", newPassword: "new12345", code: "123456" }),
    ).rejects.toMatchObject({ code: "INVALID_CURRENT_PASSWORD", status: 400 });
    auth.stop();
  });

  it("refuses an answer without a message", async () => {
    const { auth } = makeAuth("ANDROID", () => ok({}));
    await expect(auth.password.forgot({ email: "gael@example.com" })).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
    });
  });
});
