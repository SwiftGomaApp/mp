import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_EXPIRED_CODES,
  API_BASE_PATH,
  AUTH_ENDPOINTS,
  CLIENT_ERROR_CODES,
  ERROR_CODES,
  PLATFORMS,
  SELF_SIGNUP_ROLES,
  SERVER_ERROR_CODES,
  SESSION_ENDED_CODES,
  USER_ROLES,
} from "../src/core/constants";

describe("endpoints", () => {
  const paths = Object.values(AUTH_ENDPOINTS);

  it("are all under /auth, without a trailing slash", () => {
    for (const path of paths) {
      expect(path.startsWith("/auth/")).toBe(true);
      expect(path.endsWith("/")).toBe(false);
    }
  });

  it("are unique", () => {
    expect(new Set(paths).size).toBe(paths.length);
  });

  it("are relative to the versioned API root", () => {
    expect(API_BASE_PATH).toBe("/api/v1");
  });
});

describe("platforms and roles", () => {
  it("use the exact platform names of the server", () => {
    expect(Object.values(PLATFORMS).sort()).toEqual(["ANDROID", "IOS", "WEB"]);
  });

  it("let only buyers, sellers and riders sign up", () => {
    expect([...SELF_SIGNUP_ROLES]).toEqual(["BUYER", "SELLER", "RIDER"]);
    expect([...USER_ROLES].sort()).toEqual(["ADMIN", "BUYER", "RIDER", "SELLER", "SUPPORT"]);
  });
});

describe("error codes", () => {
  it("use their own name as value", () => {
    for (const [name, value] of Object.entries(ERROR_CODES)) expect(value).toBe(name);
  });

  it("are written in capital letters and underscores", () => {
    for (const value of Object.values(ERROR_CODES)) expect(value).toMatch(/^[A-Z][A-Z0-9_]+$/);
  });

  it("keep server codes and package codes apart", () => {
    const server = new Set<string>(Object.values(SERVER_ERROR_CODES));
    for (const code of Object.values(CLIENT_ERROR_CODES)) expect(server.has(code)).toBe(false);
  });

  it("end the session only for codes that really mean it", () => {
    for (const code of SESSION_ENDED_CODES) expect(Object.values(ERROR_CODES)).toContain(code);
    expect(SESSION_ENDED_CODES.has(ERROR_CODES.TOKEN_EXPIRED)).toBe(false);
    expect(SESSION_ENDED_CODES.has(ERROR_CODES.NETWORK_ERROR)).toBe(false);
    expect(SESSION_ENDED_CODES.has(ERROR_CODES.REFRESH_IN_PROGRESS)).toBe(false);
  });

  it("renew the access token only when it is expired", () => {
    expect([...ACCESS_TOKEN_EXPIRED_CODES]).toEqual(["TOKEN_EXPIRED"]);
  });
});
