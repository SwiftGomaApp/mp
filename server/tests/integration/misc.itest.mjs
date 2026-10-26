import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  authApi,
  bootApp,
  createUser,
  jobsFor,
  loginByEmailOtp,
  newDevice,
  prisma,
  resetState,
  shutdownApp,
  uniqueEmail,
} from "./helpers/harness.mjs";

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

describe("signup resend", () => {
  it("sends a new code to an unfinished signup and says the same for others", async () => {
    const email = uniqueEmail();
    const api = authApi();
    await api.post("/signup/email", {
      body: { name: "Person", email, role: "BUYER", acceptTerms: true, confirmAge: true },
    });

    const resend = await api.post("/signup/resend", { body: { email } });
    const unknown = await api.post("/signup/resend", { body: { email: uniqueEmail("ghost") } });

    expect(resend.status).toBe(200);
    expect(unknown.body).toEqual(resend.body);
    expect(await jobsFor(email, "email.otp")).toHaveLength(2);
  });

  it("does not resend for an account that is already active", async () => {
    const user = await createUser();
    await authApi().post("/signup/resend", { body: { email: user.email } });
    expect(await jobsFor(user.email, "email.otp")).toHaveLength(0);
  });
});

describe("passkeys", () => {
  async function signedIn() {
    const user = await createUser();
    const login = await loginByEmailOtp(user.email);
    return { user, token: login.body.accessToken, client: login.client };
  }

  async function addPasskey(userId, name = "Phone") {
    return prisma().passkey.create({
      data: {
        userId,
        name,
        credentialId: `cred-${Math.random()}`,
        publicKey: "key",
      },
    });
  }

  it("starts empty and gives registration options with a challenge", async () => {
    const { token, client } = await signedIn();
    const list = await client.get("/passkeys", { token });
    expect(list.body.passkeys).toEqual([]);

    const options = await client.post("/passkeys/options", { token });
    expect(options.status).toBe(200);
    expect(options.body.challenge).toEqual(expect.any(String));
    expect(options.body.rp).toMatchObject({ id: "localhost" });
  });

  it("gives sign-in options to anyone, without revealing accounts", async () => {
    const res = await authApi().post("/login/passkey/options");
    expect(res.status).toBe(200);
    expect(res.body.challengeId).toEqual(expect.any(String));
    expect(res.body.options.challenge).toEqual(expect.any(String));
    expect(res.body.options.allowCredentials).toEqual([]);
  });

  it("refuses a sign-in for a challenge that does not exist", async () => {
    const res = await authApi().post("/login/passkey/verify", {
      body: {
        challengeId: "c".repeat(43),
        device: newDevice(),
        response: {
          id: "x",
          rawId: "x",
          type: "public-key",
          response: { clientDataJSON: "x", authenticatorData: "x", signature: "x" },
          clientExtensionResults: {},
        },
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("PASSKEY_CHALLENGE_EXPIRED");
  });

  it("renames and removes only the caller's own passkeys", async () => {
    const mine = await signedIn();
    const theirs = await signedIn();
    const own = await addPasskey(mine.user.id);
    const foreign = await addPasskey(theirs.user.id);

    const rename = await mine.client.patch(`/passkeys/${own.id}`, {
      token: mine.token,
      body: { name: "Mon téléphone" },
    });
    expect(rename.status).toBe(200);
    expect((await prisma().passkey.findUnique({ where: { id: own.id } })).name).toBe(
      "Mon téléphone",
    );

    const denied = await mine.client.patch(`/passkeys/${foreign.id}`, {
      token: mine.token,
      body: { name: "Volé" },
    });
    expect(denied.status).toBe(404);
    expect(
      (await mine.client.delete(`/passkeys/${foreign.id}`, { token: mine.token })).status,
    ).toBe(404);

    const removed = await mine.client.delete(`/passkeys/${own.id}`, { token: mine.token });
    expect(removed.status).toBe(204);
    expect((await prisma().passkey.findUnique({ where: { id: own.id } })).revokedAt).not.toBeNull();
  });

  it("needs a session for everything that changes passkeys", async () => {
    const api = authApi();
    expect((await api.get("/passkeys")).status).toBe(401);
    expect((await api.post("/passkeys/options")).status).toBe(401);
  });
});

describe("request handling", () => {
  it("answers unknown routes with a French not-found error", async () => {
    const res = await authApi().get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error).toMatchObject({ code: "ROUTE_NOT_FOUND", message: "Route introuvable" });
  });

  it("rejects malformed JSON and oversized bodies", async () => {
    const bad = await authApi()
      .post("/login/otp/request", { headers: { "Content-Type": "application/json" } })
      .send("{not json");
    expect(bad.status).toBe(400);
    expect(bad.body.error.code).toBe("INVALID_JSON");

    const big = await authApi()
      .post("/login/otp/request", { headers: { "Content-Type": "application/json" } })
      .send(JSON.stringify({ email: "a".repeat(2 * 1024 * 1024) }));
    expect(big.status).toBe(413);
  });

  it("refuses browsers from origins that are not allowed", async () => {
    const res = await authApi().get("/me", { headers: { Origin: "https://evil.example.com" } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CORS_NOT_ALLOWED");
  });

  it("accepts the configured origin with credentials", async () => {
    const res = await authApi().get("/me", { headers: { Origin: "http://localhost:3000" } });
    expect(res.status).toBe(401);
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(res.headers["access-control-allow-credentials"]).toBe("true");
  });

  it("sets security headers and hides the framework", async () => {
    const res = await authApi().get("/me");
    expect(res.headers["x-powered-by"]).toBeUndefined();
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    expect(res.headers["strict-transport-security"]).toBeDefined();
  });

  it("returns a request id that can be traced", async () => {
    const res = await authApi().get("/me");
    expect(res.body.error.requestId).toEqual(expect.any(String));
    expect(res.headers["x-request-id"] ?? res.body.error.requestId).toBeTruthy();
  });
});
