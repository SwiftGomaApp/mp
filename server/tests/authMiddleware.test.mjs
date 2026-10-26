import { beforeEach, describe, expect, it } from "vitest";
import { loadWithMocks } from "./helpers/mockModules.mjs";

let credential = null;
let auth = { userId: "u1", role: "SUPPORT", sessionId: "s1" };

const { authenticate } = loadWithMocks("core/middlewares/auth.middleware.js", {
  "config/env.config.js": { getConfig: () => ({ corsOrigins: [] }) },
  "core/auth/tokens.js": { verifyAccessToken: () => auth },
  "core/auth/revocation.js": { isSessionRevoked: async () => false },
  "core/db/prisma.js": {
    getPrisma: () => ({ totpCredential: { findUnique: async () => credential } }),
  },
});

function run(path) {
  const req = { headers: { authorization: "Bearer token" }, path, method: "GET" };
  return new Promise((resolve) => authenticate(req, {}, (err) => resolve({ err, req })));
}

describe("authenticate: mandatory 2FA for the team", () => {
  beforeEach(() => {
    credential = null;
    auth = { userId: "u1", role: "SUPPORT", sessionId: "s1" };
  });

  it("blocks a Support session without confirmed 2FA", async () => {
    const { err } = await run("/sessions");
    expect(err.code).toBe("TWO_FACTOR_REQUIRED");
    expect(err.status).toBe(403);
  });

  it("blocks an Admin session whose 2FA is not confirmed", async () => {
    auth = { userId: "a1", role: "ADMIN", sessionId: "s2" };
    credential = { confirmedAt: null };
    const { err } = await run("/staff");
    expect(err.code).toBe("TWO_FACTOR_REQUIRED");
  });

  it.each([
    "/2fa/setup",
    "/2fa/confirm",
    "/step-up/otp",
    "/password/otp/request",
    "/logout",
    "/me",
  ])("lets %s through so enrollment can finish", async (path) => {
    const { err, req } = await run(path);
    expect(err).toBeUndefined();
    expect(req.auth.userId).toBe("u1");
  });

  it("lets a team member with confirmed 2FA through", async () => {
    credential = { confirmedAt: new Date() };
    const { err } = await run("/sessions");
    expect(err).toBeUndefined();
  });

  it("does not require 2FA from other roles", async () => {
    auth = { userId: "b1", role: "BUYER", sessionId: "s3" };
    const { err } = await run("/sessions");
    expect(err).toBeUndefined();
  });
});
