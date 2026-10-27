import { describe, expect, it } from "vitest";
import {
  parseCodeRequested,
  parseLogin,
  parseLogoutAll,
  parseMe,
  parseRefresh,
  parseResend,
  parseSignupVerified,
} from "../src/core/mapping";

const user = { id: "u1", name: "Aline", email: "a@x.cd", phone: "+243810000000" };

describe("parseLogin", () => {
  it("reads a mobile session", () => {
    expect(
      parseLogin({ user, accessToken: "a", refreshToken: "r", isNewDevice: true, expiresIn: 900 }),
    ).toEqual({
      kind: "session",
      user,
      isNewDevice: true,
      tokens: { accessToken: "a", refreshToken: "r", expiresIn: 900 },
    });
  });

  it("reads a web session, which has no tokens in the body", () => {
    expect(parseLogin({ user, isNewDevice: false })).toEqual({
      kind: "session",
      user,
      isNewDevice: false,
      tokens: { accessToken: null, refreshToken: null, expiresIn: undefined },
    });
  });

  it("reads the second step and the enrollment step", () => {
    expect(parseLogin({ twoFactorRequired: true, challengeToken: "c", expiresIn: 120 })).toEqual({
      kind: "challenge",
      enrollment: false,
      token: "c",
      expiresIn: 120,
    });

    expect(parseLogin({ twoFactorRequired: true, enrollment: true, challengeToken: "c" })).toEqual({
      kind: "challenge",
      enrollment: true,
      token: "c",
      expiresIn: 300,
    });
  });

  it("rejects answers it cannot understand", () => {
    for (const bad of [null, "text", [], {}, { user: {} }, { twoFactorRequired: true }]) {
      expect(() => parseLogin(bad)).toThrowError(/inattendue/);
    }
  });
});

describe("other parsers", () => {
  it("reads a verified sign-up", () => {
    expect(parseSignupVerified({ user, accessToken: "a", refreshToken: "r" })).toEqual({
      user,
      tokens: { accessToken: "a", refreshToken: "r", expiresIn: undefined },
    });
  });

  it("reads a code request and turns a numeric expiry into text", () => {
    expect(parseCodeRequested({ method: "EMAIL", target: "a@x.cd", expiresMinutes: 10 })).toEqual({
      method: "EMAIL",
      target: "a@x.cd",
      expiresMinutes: "10",
    });
    expect(() => parseCodeRequested({ method: "FAX", target: "x", expiresMinutes: 1 })).toThrow();
    expect(() => parseCodeRequested({ method: "PHONE", expiresMinutes: 1 })).toThrow();
  });

  it("reads resend, logout-all, me and refresh answers", () => {
    expect(parseResend({ message: "ok" })).toEqual({ message: "ok" });
    expect(parseLogoutAll({ revoked: 3 })).toEqual({ revoked: 3 });
    expect(parseMe({ user }).id).toBe("u1");
    expect(parseRefresh({ expiresIn: 900 })).toEqual({
      accessToken: null,
      refreshToken: null,
      expiresIn: 900,
    });
    expect(() => parseResend({})).toThrow();
    expect(() => parseLogoutAll({ revoked: "3" })).toThrow();
    expect(() => parseMe({})).toThrow();
  });
});
