import { describe, expect, it } from "vitest";
import { ConflictError, UnauthorizedError, ValidationError, hasErrorCode } from "../src/index";
import { USER, fail, makeAuth, ok } from "./helpers";
import type { Reply } from "./helpers";

const DEVICE = { deviceId: "device-id-0001", deviceName: "Test device" };

const phoneTokens = (extra: object = {}): Reply =>
  ok({ user: USER, accessToken: "access-1", refreshToken: "refresh-1", ...extra });

describe("signup", () => {
  const input = {
    name: "Gael",
    role: "BUYER" as const,
    acceptTerms: true as const,
    confirmAge: true as const,
  };

  it("starts with an e-mail and reports where the code went", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => ({
      status: 201,
      data: { method: "EMAIL", target: "gael@example.com", expiresMinutes: 10 },
    }));
    const sent = await auth.signup.email({ ...input, email: "gael@example.com" });

    expect(sent).toEqual({ method: "EMAIL", target: "gael@example.com", expiresMinutes: 10 });
    expect(calls[0]).toMatchObject({ method: "post", url: "/auth/signup/email" });
    expect(calls[0]?.body).toEqual({ ...input, email: "gael@example.com" });
  });

  it("starts with a phone number", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => ({
      status: 201,
      data: { method: "PHONE", target: "+243990000000", expiresMinutes: 10 },
    }));
    const sent = await auth.signup.phone({ ...input, phone: "+243990000000" });
    expect(sent.method).toBe("PHONE");
    expect(calls[0]?.url).toBe("/auth/signup/phone");
  });

  it("confirms the code and signs a phone in with its tokens", async () => {
    const { auth, calls, storage } = makeAuth("ANDROID", () => phoneTokens());
    const { user } = await auth.signup.verify({ email: "gael@example.com", code: "123456" });

    expect(user).toEqual(USER);
    expect(calls[0]?.url).toBe("/auth/signup/verify");
    expect(calls[0]?.body).toEqual({
      email: "gael@example.com",
      code: "123456",
      device: { ...DEVICE, platform: "ANDROID" },
    });
    expect(auth.session.getState()).toMatchObject({ status: "authenticated", user: USER });
    expect(await auth.session.getAccessToken()).toBe("access-1");
    expect(await storage.getItem("swiftgoma-mp-auth.refreshToken")).toBe("refresh-1");
  });

  it("confirms by phone", async () => {
    const { auth, calls } = makeAuth("IOS", () => phoneTokens());
    await auth.signup.verify({ phone: "+243990000000", code: "123456" });
    expect(calls[0]?.body).toMatchObject({ phone: "+243990000000", device: { platform: "IOS" } });
  });

  it("signs a browser in without any token", async () => {
    const { auth, calls, storage } = makeAuth("WEB", () => ok({ user: USER }));
    await auth.signup.verify({ email: "gael@example.com", code: "123456" });

    expect(calls[0]?.body.device.platform).toBe("WEB");
    expect(calls[0]?.withCredentials).toBe(true);
    expect(auth.session.getState().status).toBe("authenticated");
    expect(await auth.session.getAccessToken()).toBeNull();
    expect(await storage.getItem("swiftgoma-mp-auth.refreshToken")).toBeNull();
  });

  it("uses the lifetime the server reports", async () => {
    const { auth } = makeAuth("WEB", () => ok({ user: USER, expiresIn: 600 }));
    const before = Date.now();
    await auth.signup.verify({ email: "gael@example.com", code: "123456" });
    const expiresAt = auth.session.getState().accessExpiresAt ?? 0;
    expect(expiresAt - before).toBeGreaterThanOrEqual(599_000);
    expect(expiresAt - before).toBeLessThan(602_000);
  });

  it("refuses a phone answer that has no tokens", async () => {
    const { auth } = makeAuth("ANDROID", () => ok({ user: USER }));
    await expect(
      auth.signup.verify({ email: "gael@example.com", code: "123456" }),
    ).rejects.toMatchObject({ code: "UNKNOWN_ERROR" });
    expect(auth.session.getState().status).toBe("unknown");
  });

  it("resends the code", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => ok({ message: "Si le compte existe..." }));
    expect(await auth.signup.resend({ email: "gael@example.com" })).toEqual({
      message: "Si le compte existe...",
    });
    expect(calls[0]).toMatchObject({
      url: "/auth/signup/resend",
      body: { email: "gael@example.com" },
    });
  });

  it("passes the server errors through, typed", async () => {
    const exists = makeAuth("ANDROID", () => fail(409, "ACCOUNT_EXISTS"));
    const conflict = await exists.auth.signup
      .email({ ...input, email: "gael@example.com" })
      .catch((e: unknown) => e);
    expect(conflict).toBeInstanceOf(ConflictError);
    expect(hasErrorCode(conflict, "ACCOUNT_EXISTS")).toBe(true);

    const invalid = makeAuth("ANDROID", () =>
      fail(422, "VALIDATION_ERROR", { details: [{ field: "email", message: "E-mail invalide" }] }),
    );
    const validation = await invalid.auth.signup
      .email({ ...input, email: "nope" })
      .catch((e: unknown) => e);
    expect(validation).toBeInstanceOf(ValidationError);
    expect((validation as ValidationError).messagesByField).toEqual({ email: "E-mail invalide" });
  });
});

describe("login with a code", () => {
  it("asks for an e-mail code", async () => {
    const { auth, calls } = makeAuth("ANDROID", () =>
      ok({ method: "EMAIL", target: "gael@example.com", expiresMinutes: 10 }),
    );
    const sent = await auth.login.emailCode.request({ email: "gael@example.com" });
    expect(sent.method).toBe("EMAIL");
    expect(calls[0]).toMatchObject({
      url: "/auth/login/otp/request",
      body: { email: "gael@example.com" },
    });
  });

  it("asks for a phone code, optionally sent to the e-mail instead", async () => {
    const { auth, calls } = makeAuth("ANDROID", () =>
      ok({ method: "EMAIL", target: "g***@example.com", expiresMinutes: 10 }),
    );
    const sent = await auth.login.phoneCode.request({ phone: "+243990000000", channel: "EMAIL" });
    expect(sent.target).toBe("g***@example.com");
    expect(calls[0]?.body).toEqual({ phone: "+243990000000", channel: "EMAIL" });
  });

  it("ends authenticated, and says whether the device is new", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => phoneTokens({ isNewDevice: true }));
    const result = await auth.login.emailCode.verify({ email: "gael@example.com", code: "123456" });

    expect(result).toEqual({ status: "authenticated", user: USER, isNewDevice: true });
    expect(calls[0]?.url).toBe("/auth/login/otp/verify");
    expect(calls[0]?.body.device).toMatchObject({ platform: "ANDROID", deviceId: DEVICE.deviceId });
    expect(auth.session.getState().status).toBe("authenticated");
  });

  it("works for a phone code in a browser", async () => {
    const { auth } = makeAuth("WEB", () => ok({ user: USER, isNewDevice: false }));
    const result = await auth.login.phoneCode.verify({ phone: "+243990000000", code: "123456" });
    expect(result).toEqual({ status: "authenticated", user: USER, isNewDevice: false });
  });

  it("reports a wrong code without opening a session", async () => {
    const { auth } = makeAuth("ANDROID", () => fail(400, "OTP_INVALID"));
    await expect(
      auth.login.emailCode.verify({ email: "gael@example.com", code: "000000" }),
    ).rejects.toMatchObject({ code: "OTP_INVALID", status: 400 });
    expect(auth.session.getState().status).toBe("unknown");
  });
});

describe("login with a password", () => {
  it("ends authenticated", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => phoneTokens({ isNewDevice: false }));
    const result = await auth.login.password({ email: "gael@example.com", password: "secret123" });

    expect(result.status).toBe("authenticated");
    expect(calls[0]).toMatchObject({ url: "/auth/login/password" });
    expect(calls[0]?.body).toMatchObject({ email: "gael@example.com", password: "secret123" });
  });

  it("does not try to refresh on a wrong password", async () => {
    const { auth, calls } = makeAuth("ANDROID", () => fail(401, "INVALID_CREDENTIALS"));
    const error = await auth.login
      .password({ email: "gael@example.com", password: "bad" })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedError);
    expect(calls).toHaveLength(1);
  });
});

describe("a sign-in that needs a second step", () => {
  const second = (extra: object = {}): Reply => ({
    status: 202,
    data: { twoFactorRequired: true, challengeToken: "c".repeat(40), expiresIn: 300, ...extra },
  });

  it("reports it and opens no session", async () => {
    const { auth } = makeAuth("ANDROID", () => second());
    const result = await auth.login.password({ email: "gael@example.com", password: "secret123" });

    expect(result).toEqual({ status: "twoFactorRequired", expiresInSeconds: 300 });
    expect(auth.session.getState().status).toBe("unknown");
    expect(await auth.session.getAccessToken()).toBeNull();
  });

  it("reports a first-time enrollment for staff", async () => {
    const { auth } = makeAuth("WEB", () => second({ enrollment: true }));
    const result = await auth.login.emailCode.verify({
      email: "staff@example.com",
      code: "123456",
    });
    expect(result).toEqual({ status: "twoFactorEnrollmentRequired", expiresInSeconds: 300 });
  });

  it("refuses a second-step answer without a token", async () => {
    const { auth } = makeAuth("ANDROID", () => ({
      status: 202,
      data: { twoFactorRequired: true },
    }));
    await expect(
      auth.login.password({ email: "gael@example.com", password: "secret123" }),
    ).rejects.toMatchObject({ code: "UNKNOWN_ERROR" });
  });
});
