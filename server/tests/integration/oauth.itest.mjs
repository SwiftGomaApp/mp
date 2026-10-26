import { createSign, generateKeyPairSync } from "node:crypto";
import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  alertsFor,
  authApi,
  bootApp,
  createUser,
  enableTotp,
  loginByEmailOtp,
  newDevice,
  prisma,
  resetState,
  sessionTokenFor,
  shutdownApp,
  stepUpCode,
  uniqueEmail,
} from "./helpers/harness.mjs";

const require = createRequire(import.meta.url);
const { OAuth2Client } = require("google-auth-library");
const { consumeNonce } = require("../../src/core/auth/nonce");

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

// ---------------------------------------------------------------- Google (verifier stubbed)
let googlePayload = null;
const realVerify = OAuth2Client.prototype.verifyIdToken;

beforeAll(() => {
  OAuth2Client.prototype.verifyIdToken = async () => {
    if (!googlePayload) throw new Error("invalid token");
    return { getPayload: () => googlePayload };
  };
});
afterAll(() => {
  OAuth2Client.prototype.verifyIdToken = realVerify;
});

async function issueNonce(api = authApi()) {
  const res = await api.post("/oauth/nonce");
  return res.body.nonce;
}

function google(overrides = {}) {
  googlePayload = {
    sub: `google-sub-${Math.random()}`,
    email: uniqueEmail("g"),
    email_verified: true,
    name: "Grace Google",
    ...overrides,
  };
  return googlePayload;
}

const signupBody = (extra) => ({
  idToken: "google-token",
  role: "BUYER",
  acceptTerms: true,
  confirmAge: true,
  device: newDevice(),
  ...extra,
});

// ---------------------------------------------------------------- Apple (real RS256 verification)
const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const KID = "test-key-1";
const appleJwk = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };
const realFetch = globalThis.fetch;

beforeAll(() => {
  globalThis.fetch = vi.fn(async (url, options) => {
    if (String(url).startsWith("https://appleid.apple.com/auth/keys")) {
      return { ok: true, json: async () => ({ keys: [appleJwk] }) };
    }
    return realFetch(url, options);
  });
});
afterAll(() => {
  globalThis.fetch = realFetch;
});

function appleToken(claims = {}) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", kid: KID, typ: "JWT" };
  const payload = {
    iss: "https://appleid.apple.com",
    aud: "test.apple.client",
    sub: `apple-sub-${Math.random()}`,
    iat: now,
    exp: now + 600,
    email: uniqueEmail("a"),
    email_verified: "true",
    ...claims,
  };
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const input = `${encode(header)}.${encode(payload)}`;
  const signature = createSign("RSA-SHA256").update(input).sign(privateKey).toString("base64url");
  return { token: `${input}.${signature}`, payload };
}

describe("OAuth nonce", () => {
  it("issues a fresh random nonce each time", async () => {
    const api = authApi();
    const first = await api.post("/oauth/nonce");
    const second = await api.post("/oauth/nonce");

    expect(first.status).toBe(200);
    expect(first.headers["cache-control"]).toBe("no-store");
    expect(first.body.nonce).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(second.body.nonce).not.toBe(first.body.nonce);
  });

  it("can only be consumed once", async () => {
    const { body } = await authApi().post("/oauth/nonce");
    await expect(consumeNonce(body.nonce, "BAD")).resolves.toBeUndefined();
    await expect(consumeNonce(body.nonce, "BAD")).rejects.toMatchObject({ code: "BAD" });
  });
});

describe("Google", () => {
  it("creates an account on first sign-up and signs the user in", async () => {
    const nonce = await issueNonce();
    const payload = google({ nonce });
    const res = await authApi().post("/signup/google", { body: signupBody({ nonce }) });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: payload.email, role: "BUYER", status: "ACTIVE" });
    const link = await prisma().oAuthAccount.findFirst({ where: { provider: "GOOGLE" } });
    expect(link.providerAccountId).toBe(payload.sub);
    const stored = await prisma().user.findUnique({ where: { email: payload.email } });
    expect(stored.emailVerifiedAt).not.toBeNull();
    expect(stored.termsVersion).toBe("1.0");
  });

  it("signs a returning user in", async () => {
    const first = await issueNonce();
    const payload = google({ nonce: first });
    await authApi().post("/signup/google", { body: signupBody({ nonce: first }) });

    const nonce = await issueNonce();
    google({ sub: payload.sub, email: payload.email, nonce });
    const res = await authApi().post("/login/google", {
      body: { idToken: "google-token", nonce, device: newDevice() },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(payload.email);
  });

  it("refuses a nonce that was not issued by the server", async () => {
    const nonce = "n".repeat(43);
    google({ nonce });
    const res = await authApi().post("/signup/google", { body: signupBody({ nonce }) });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("GOOGLE_NONCE_INVALID");
  });

  it("refuses a nonce that does not match the token", async () => {
    const issued = await issueNonce();
    google({ nonce: "x".repeat(43) });
    const res = await authApi().post("/signup/google", { body: signupBody({ nonce: issued }) });
    expect(res.status).toBe(401);
  });

  it("refuses to use the same nonce twice", async () => {
    const nonce = await issueNonce();
    google({ nonce });
    expect((await authApi().post("/signup/google", { body: signupBody({ nonce }) })).status).toBe(
      200,
    );
    const replay = await authApi().post("/signup/google", { body: signupBody({ nonce }) });
    expect(replay.status).toBe(401);
  });

  it("requires the nonce in the request", async () => {
    google();
    const res = await authApi().post("/login/google", {
      body: { idToken: "google-token", device: newDevice() },
    });
    expect(res.status).toBe(422);
  });

  it("refuses an email Google has not verified", async () => {
    const nonce = await issueNonce();
    google({ nonce, email_verified: false });
    const res = await authApi().post("/signup/google", { body: signupBody({ nonce }) });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("GOOGLE_EMAIL_NOT_VERIFIED");
  });

  it("refuses a token Google rejects", async () => {
    googlePayload = null;
    const nonce = await issueNonce();
    const res = await authApi().post("/signup/google", { body: signupBody({ nonce }) });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("GOOGLE_TOKEN_INVALID");
  });

  it("does not create team accounts", async () => {
    const nonce = await issueNonce();
    google({ nonce });
    const res = await authApi().post("/signup/google", {
      body: signupBody({ nonce, role: "ADMIN" }),
    });
    expect(res.status).toBe(422);
  });

  it("reports an unknown Google user as having no account", async () => {
    const nonce = await issueNonce();
    google({ nonce });
    const res = await authApi().post("/login/google", {
      body: { idToken: "google-token", nonce, device: newDevice() },
    });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ACCOUNT_NOT_FOUND");
  });

  it("links to an existing account whose email is verified, then signs in", async () => {
    const user = await createUser();
    const nonce = await issueNonce();
    const payload = google({ nonce, email: user.email });

    const res = await authApi().post("/login/google", {
      body: { idToken: "google-token", nonce, device: newDevice() },
    });
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);

    const link = await prisma().oAuthAccount.findFirst({ where: { userId: user.id } });
    expect(link.providerAccountId).toBe(payload.sub);
    expect(await prisma().user.count()).toBe(1);

    const log = await prisma().activityLog.findFirst({
      where: { userId: user.id, event: "OAUTH_ACCOUNT_LINKED" },
    });
    expect(log.metadata).toMatchObject({ provider: "GOOGLE", via: "verified-email" });
    const alerts = await alertsFor(user.email);
    expect(alerts.map((a) => a.data.type)).toContain("LOGIN_METHOD_ADDED");
  });

  it("links on sign-up too, instead of creating a duplicate", async () => {
    const user = await createUser();
    const nonce = await issueNonce();
    google({ nonce, email: user.email });
    const res = await authApi().post("/signup/google", {
      body: signupBody({ nonce, role: "SELLER" }),
    });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(res.body.user.role).toBe("BUYER");
    expect(await prisma().user.count()).toBe(1);
  });

  it("still asks for 2FA after linking", async () => {
    const user = await createUser();
    await enableTotp(user.id);
    const nonce = await issueNonce();
    google({ nonce, email: user.email });
    const res = await authApi().post("/login/google", {
      body: { idToken: "google-token", nonce, device: newDevice() },
    });
    expect(res.status).toBe(202);
    expect(res.body.twoFactorRequired).toBe(true);
  });

  it("does not link to an account whose email was never verified", async () => {
    const email = uniqueEmail("pending");
    await prisma().user.create({ data: { email, role: "BUYER", status: "PENDING" } });
    const nonce = await issueNonce();
    google({ nonce, email });
    const res = await authApi().post("/login/google", {
      body: { idToken: "google-token", nonce, device: newDevice() },
    });
    expect(res.status).toBe(404);
  });

  it("keeps suspended accounts out even through Google", async () => {
    const user = await createUser({ status: "SUSPENDED" });
    const nonce = await issueNonce();
    google({ nonce, email: user.email });
    const res = await authApi().post("/login/google", {
      body: { idToken: "google-token", nonce, device: newDevice() },
    });
    expect(res.status).toBe(403);
    expect(await prisma().oAuthAccount.count()).toBe(0);
  });

  it("lets a signed-in user link Google with a fresh code", async () => {
    const user = await createUser();
    const login = await loginByEmailOtp(user.email);
    const token = login.body.accessToken;
    const payload = google({ email: "someone.else@example.com" });

    const res = await login.client.post("/google/link", {
      token,
      body: {
        idToken: "google-token",
        stepUpCode: await stepUpCode(login.client, token, user),
      },
    });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ linked: true, alreadyLinked: false });
    expect(
      (await prisma().oAuthAccount.findFirst({ where: { userId: user.id } })).providerAccountId,
    ).toBe(payload.sub);
  });

  it("refuses to link a Google account that belongs to someone else", async () => {
    const owner = await createUser();
    await prisma().oAuthAccount.create({
      data: { userId: owner.id, provider: "GOOGLE", providerAccountId: "shared-sub" },
    });
    const user = await createUser();
    const login = await loginByEmailOtp(user.email);
    google({ sub: "shared-sub" });

    const res = await login.client.post("/google/link", {
      token: login.body.accessToken,
      body: {
        idToken: "google-token",
        stepUpCode: await stepUpCode(login.client, login.body.accessToken, user),
      },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("GOOGLE_ACCOUNT_ALREADY_LINKED");
  });
});

describe("Apple", () => {
  async function appleBody(extra = {}, claims = {}) {
    const nonce = await issueNonce();
    const { token, payload } = appleToken({ nonce, ...claims });
    return { nonce, payload, body: { idToken: token, nonce, device: newDevice(), ...extra } };
  }

  it("creates an account and signs the user in", async () => {
    const { payload, body } = await appleBody({
      role: "RIDER",
      acceptTerms: true,
      confirmAge: true,
      name: "Alice Apple",
    });
    const res = await authApi().post("/signup/apple", { body });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: payload.email, role: "RIDER" });
    expect(await prisma().oAuthAccount.count({ where: { provider: "APPLE" } })).toBe(1);
  });

  it("signs a returning user in", async () => {
    const first = await appleBody({ role: "BUYER", acceptTerms: true, confirmAge: true });
    await authApi().post("/signup/apple", { body: first.body });

    const again = await appleBody({}, { sub: first.payload.sub, email: first.payload.email });
    const res = await authApi().post("/login/apple", { body: again.body });
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(first.payload.email);
  });

  it("links to an existing account with the same verified email", async () => {
    const user = await createUser();
    const { body } = await appleBody({}, { email: user.email });
    const res = await authApi().post("/login/apple", { body });

    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
    expect(await prisma().user.count()).toBe(1);
    expect(
      await prisma().oAuthAccount.count({ where: { userId: user.id, provider: "APPLE" } }),
    ).toBe(1);
  });

  it("rejects a token signed with another key", async () => {
    const nonce = await issueNonce();
    const { token } = appleToken({ nonce });
    const tampered = `${token.slice(0, -6)}AAAAAA`;
    const res = await authApi().post("/login/apple", {
      body: { idToken: tampered, nonce, device: newDevice() },
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("APPLE_TOKEN_INVALID");
  });

  it("rejects a token for another app, an expired token and a wrong issuer", async () => {
    const now = Math.floor(Date.now() / 1000);
    for (const claims of [
      { aud: "someone.else" },
      { exp: now - 10, iat: now - 700 },
      { iss: "https://evil.example.com" },
    ]) {
      const { body } = await appleBody({}, claims);
      const res = await authApi().post("/login/apple", { body });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("APPLE_TOKEN_INVALID");
    }
  });

  it("rejects a nonce that does not match the token", async () => {
    const issued = await issueNonce();
    const { token } = appleToken({ nonce: "y".repeat(43) });
    const res = await authApi().post("/login/apple", {
      body: { idToken: token, nonce: issued, device: newDevice() },
    });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("APPLE_NONCE_INVALID");
  });

  it("burns the nonce after one use", async () => {
    const { body } = await appleBody({}, { email: uniqueEmail("new") });
    await authApi().post("/login/apple", { body });
    const replay = await authApi().post("/login/apple", { body });
    expect(replay.status).toBe(401);
  });

  it("lets a signed-in user link Apple with a fresh code", async () => {
    const user = await createUser();
    const login = await loginByEmailOtp(user.email);
    const token = login.body.accessToken;
    const { nonce, token: idToken } = await (async () => {
      const n = await issueNonce();
      return {
        nonce: n,
        token: appleToken({ nonce: n, email: "private@relay.example.com" }).token,
      };
    })();

    const res = await login.client.post("/apple/link", {
      token,
      body: { idToken, nonce, stepUpCode: await stepUpCode(login.client, token, user) },
    });
    expect(res.status).toBe(201);
    expect(res.body.linked).toBe(true);
    const alerts = await alertsFor(user.email);
    expect(alerts.map((a) => a.data.type)).toContain("LOGIN_METHOD_ADDED");
  });
});

describe("a session token for tests", () => {
  it("builds a usable session without a login", async () => {
    const user = await createUser();
    const token = await sessionTokenFor(user);
    expect((await authApi().get("/me", { token })).status).toBe(200);
  });
});
