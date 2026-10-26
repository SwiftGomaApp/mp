import { beforeEach, describe, expect, it } from "vitest";
import { loadWithMocks } from "../helpers/mockModules.mjs";

let auth;
let revoked;
let credential;
let user;

const middleware = loadWithMocks("core/middlewares/auth.middleware.js", {
  "config/env.config.js": { getConfig: () => ({ corsOrigins: ["https://app.example.com"] }) },
  "core/auth/tokens.js": {
    verifyAccessToken: (token) => {
      if (token === "bad") throw Object.assign(new Error("bad"), { name: "JsonWebTokenError" });
      return auth;
    },
  },
  "core/auth/revocation.js": { isSessionRevoked: async () => revoked },
  "core/db/prisma.js": {
    getPrisma: () => ({
      totpCredential: { findUnique: async () => credential },
      user: { findUnique: async () => user },
    }),
  },
});

function run(handler, req) {
  const request = Object.assign(req, {
    headers: req.headers ?? {},
    cookies: req.cookies ?? {},
    method: req.method ?? "GET",
    path: req.path ?? "/x",
  });
  return new Promise((resolve) => {
    const result = handler(request, {}, (err) => resolve(err));
    if (result?.catch) result.catch(resolve);
  });
}

beforeEach(() => {
  auth = { userId: "u1", role: "BUYER", sessionId: "s1" };
  revoked = false;
  credential = null;
  user = { verificationStatus: "APPROVED" };
});

describe("authenticate", () => {
  it("asks for a token", async () => {
    const err = await run(middleware.authenticate, {});
    expect(err.status).toBe(401);
  });

  it("accepts a bearer token whatever the case of the scheme", async () => {
    for (const scheme of ["Bearer", "bearer", "BEARER"]) {
      const req = { headers: { authorization: `${scheme} token` } };
      const err = await run(middleware.authenticate, req);
      expect(err).toBeUndefined();
    }
  });

  it("falls back to the cookie and does not require an origin for reads", async () => {
    const req = { cookies: { "__Host-swg_access": "token" } };
    expect(await run(middleware.authenticate, req)).toBeUndefined();
  });

  it("requires a trusted origin for cookie-authenticated writes", async () => {
    const base = { cookies: { "__Host-swg_access": "token" }, method: "POST" };
    expect((await run(middleware.authenticate, base)).code).toBe("CORS_NOT_ALLOWED");
    expect(
      (
        await run(middleware.authenticate, {
          ...base,
          headers: { origin: "https://evil.example.com" },
        })
      ).code,
    ).toBe("CORS_NOT_ALLOWED");
    expect(
      await run(middleware.authenticate, {
        ...base,
        headers: { origin: "https://app.example.com" },
      }),
    ).toBeUndefined();
  });

  it("does not require an origin for bearer writes", async () => {
    const req = { headers: { authorization: "Bearer token" }, method: "POST" };
    expect(await run(middleware.authenticate, req)).toBeUndefined();
  });

  it("rejects invalid tokens and revoked sessions", async () => {
    const invalid = await run(middleware.authenticate, {
      headers: { authorization: "Bearer bad" },
    });
    expect(invalid.name).toBe("JsonWebTokenError");

    revoked = true;
    const gone = await run(middleware.authenticate, { headers: { authorization: "Bearer token" } });
    expect(gone.status).toBe(401);
    expect(gone.code).toBe("SESSION_REVOKED");
  });

  it("exposes the authenticated identity", async () => {
    const req = { headers: { authorization: "Bearer token" } };
    await run(middleware.authenticate, req);
    expect(req.auth).toEqual({ ...auth, source: "bearer" });
  });
});

describe("requireRole", () => {
  it("lets only the listed roles through", async () => {
    const guard = middleware.requireRole("ADMIN", "SUPPORT");
    expect(await run(guard, { auth: { role: "ADMIN" } })).toBeUndefined();
    expect(await run(guard, { auth: { role: "SUPPORT" } })).toBeUndefined();
    expect((await run(guard, { auth: { role: "BUYER" } })).status).toBe(403);
  });

  it("asks for a login when nobody is authenticated", async () => {
    expect((await run(middleware.requireRole("ADMIN"), {})).status).toBe(401);
  });
});

describe("requireApproved", () => {
  it("lets approved users through", async () => {
    const guard = middleware.requireApproved();
    expect(await run(guard, { auth: { userId: "u1" } })).toBeUndefined();
  });

  it.each(["NOT_SUBMITTED", "PENDING", "IN_REVIEW", "REJECTED"])(
    "blocks %s files",
    async (status) => {
      user = { verificationStatus: status };
      const err = await run(middleware.requireApproved(), { auth: { userId: "u1" } });
      expect(err.status).toBe(403);
      expect(err.code).toBe("VERIFICATION_REQUIRED");
    },
  );

  it("blocks unknown users and anonymous callers", async () => {
    user = null;
    expect((await run(middleware.requireApproved(), { auth: { userId: "u1" } })).status).toBe(403);
    expect((await run(middleware.requireApproved(), {})).status).toBe(401);
  });
});

describe("assertTrustedOrigin", () => {
  it("never blocks safe methods", () => {
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      expect(() => middleware.assertTrustedOrigin({ method, headers: {} })).not.toThrow();
    }
  });

  it("blocks unsafe methods from unknown origins", () => {
    expect(() => middleware.assertTrustedOrigin({ method: "DELETE", headers: {} })).toThrow();
    const ok = { method: "DELETE", headers: { origin: "https://app.example.com" } };
    expect(() => middleware.assertTrustedOrigin(ok)).not.toThrow();
  });
});
