import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  authApi,
  bootApp,
  createUser,
  enableTotp,
  freshTotp,
  loginByEmailOtp,
  loginWithTotp,
  prisma,
  resetState,
  sessionTokenFor,
  shutdownApp,
  stepUpCode,
  totpCode,
} from "./helpers/harness.mjs";

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

async function signedIn(overrides) {
  const user = await createUser(overrides);
  const login = await loginByEmailOtp(user.email);
  return { user, token: login.body.accessToken, client: login.client };
}

async function enroll({ user, token, client }) {
  const setup = await client.post("/2fa/setup", { token });
  const confirm = await client.post("/2fa/confirm", {
    token,
    body: {
      code: totpCode(setup.body.secret),
      stepUpCode: await stepUpCode(client, token, user),
    },
  });
  return { secret: setup.body.secret, backupCodes: confirm.body.backupCodes, confirm };
}

describe("setting up two-step verification", () => {
  it("starts disabled and optional for buyers", async () => {
    const { token, client } = await signedIn();
    const res = await client.get("/2fa", { token });
    expect(res.body).toEqual({ enabled: false, mandatory: false, backupCodesRemaining: 0 });
  });

  it("gives a secret and keeps it for a few minutes", async () => {
    const { token, client } = await signedIn();
    const first = await client.post("/2fa/setup", { token });
    const second = await client.post("/2fa/setup", { token });

    expect(first.status).toBe(200);
    expect(first.body.secret).toMatch(/^[A-Z2-7]{32}$/);
    expect(first.body.otpauthUri).toContain("otpauth://totp/");
    expect(second.body.secret).toBe(first.body.secret);
  });

  it("stores the secret encrypted", async () => {
    const session = await signedIn();
    const setup = await session.client.post("/2fa/setup", { token: session.token });
    const stored = await prisma().totpCredential.findUnique({ where: { userId: session.user.id } });
    expect(stored.secretEncrypted).not.toContain(setup.body.secret);
  });

  it("is activated with an app code and a fresh code, and returns ten backup codes", async () => {
    const session = await signedIn();
    const { backupCodes, confirm } = await enroll(session);

    expect(confirm.status).toBe(200);
    expect(backupCodes).toHaveLength(10);

    const status = await session.client.get("/2fa", { token: session.token });
    expect(status.body).toMatchObject({ enabled: true, backupCodesRemaining: 10 });
  });

  it("refuses a wrong app code", async () => {
    const session = await signedIn();
    await session.client.post("/2fa/setup", { token: session.token });
    const res = await session.client.post("/2fa/confirm", {
      token: session.token,
      body: {
        code: "000000",
        stepUpCode: await stepUpCode(session.client, session.token, session.user),
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("TWO_FACTOR_INVALID");
  });
});

describe("signing in with two-step verification", () => {
  async function protectedUser() {
    const session = await signedIn();
    const { secret, backupCodes } = await enroll(session);
    return { ...session, secret, backupCodes };
  }

  it("asks for the app code after the email code", async () => {
    const { user } = await protectedUser();
    const login = await loginByEmailOtp(user.email);
    expect(login.response.status).toBe(202);
    expect(login.body).toMatchObject({ twoFactorRequired: true });
    expect(login.body.challengeToken).toEqual(expect.any(String));
    expect(login.body.accessToken).toBeUndefined();
  });

  it("completes the login with a valid app code", async () => {
    const { user, secret } = await protectedUser();
    const login = await loginWithTotp(user, secret);
    expect(login.response.status).toBe(200);
    expect(login.body.accessToken).toEqual(expect.any(String));
  });

  it("does not accept the same app code twice", async () => {
    const { user, secret } = await protectedUser();
    const first = await loginByEmailOtp(user.email);
    const code = await freshTotp(user.id, secret);
    const ok = await first.client.post("/2fa/verify", {
      body: { challengeToken: first.body.challengeToken, code },
    });
    expect(ok.status).toBe(200);

    const second = await loginByEmailOtp(user.email);
    const replay = await second.client.post("/2fa/verify", {
      body: { challengeToken: second.body.challengeToken, code },
    });
    expect(replay.status).toBe(400);
    expect(replay.body.error.code).toBe("TWO_FACTOR_INVALID");
  });

  it("lets a backup code replace the app code, once", async () => {
    const { user, backupCodes } = await protectedUser();
    const first = await loginByEmailOtp(user.email);
    const ok = await first.client.post("/2fa/verify", {
      body: { challengeToken: first.body.challengeToken, backupCode: backupCodes[0] },
    });
    expect(ok.status).toBe(200);

    const second = await loginByEmailOtp(user.email);
    const again = await second.client.post("/2fa/verify", {
      body: { challengeToken: second.body.challengeToken, backupCode: backupCodes[0] },
    });
    expect(again.status).toBe(400);

    const status = await first.client.get("/2fa", { token: ok.body.accessToken });
    expect(status.body.backupCodesRemaining).toBe(9);
  });

  it("locks after repeated wrong codes", async () => {
    const { user } = await protectedUser();
    const login = await loginByEmailOtp(user.email);
    let last;
    for (let i = 0; i < 6; i += 1) {
      last = await login.client.post("/2fa/verify", {
        body: { challengeToken: login.body.challengeToken, code: "000000" },
      });
    }
    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe("TWO_FACTOR_LOCKED");
  });

  it("makes the challenge single-use", async () => {
    const { user, secret } = await protectedUser();
    const login = await loginByEmailOtp(user.email);
    const code = await freshTotp(user.id, secret);
    expect(
      (
        await login.client.post("/2fa/verify", {
          body: { challengeToken: login.body.challengeToken, code },
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await login.client.post("/2fa/verify", {
          body: {
            challengeToken: login.body.challengeToken,
            code: await freshTotp(user.id, secret),
          },
        })
      ).status,
    ).toBe(401);
  });

  it("can be disabled by a buyer with a valid code", async () => {
    const { user, secret, token, client } = await protectedUser();
    const res = await client.post("/2fa/disable", {
      token,
      body: { code: await freshTotp(user.id, secret) },
    });
    expect(res.status).toBe(200);
    expect(await prisma().totpCredential.count({ where: { userId: user.id } })).toBe(0);
  });

  it("regenerates the backup codes and invalidates the old ones", async () => {
    const { user, secret, token, client, backupCodes } = await protectedUser();
    const res = await client.post("/2fa/backup-codes", {
      token,
      body: { code: await freshTotp(user.id, secret) },
    });
    expect(res.status).toBe(200);
    expect(res.body.backupCodes).toHaveLength(10);
    expect(res.body.backupCodes).not.toContain(backupCodes[0]);

    const login = await loginByEmailOtp(user.email);
    const old = await login.client.post("/2fa/verify", {
      body: { challengeToken: login.body.challengeToken, backupCode: backupCodes[0] },
    });
    expect(old.status).toBe(400);
  });
});

describe("mandatory for the team", () => {
  it("forces a new Support member to enroll before getting a session", async () => {
    const support = await createUser({ role: "SUPPORT" });
    const login = await loginByEmailOtp(support.email);

    expect(login.response.status).toBe(202);
    expect(login.body).toMatchObject({ twoFactorRequired: true, enrollment: true });

    const setup = await login.client.post("/2fa/enroll/setup", {
      body: { challengeToken: login.body.challengeToken },
    });
    expect(setup.status).toBe(200);

    const confirm = await login.client.post("/2fa/enroll/confirm", {
      body: { challengeToken: login.body.challengeToken, code: totpCode(setup.body.secret) },
    });
    expect(confirm.status).toBe(200);
    expect(confirm.body.accessToken).toEqual(expect.any(String));
    expect(confirm.body.backupCodes).toHaveLength(10);

    const status = await login.client.get("/2fa", { token: confirm.body.accessToken });
    expect(status.body).toMatchObject({ enabled: true, mandatory: true });
  });

  it("does not let them turn it off", async () => {
    const support = await createUser({ role: "SUPPORT" });
    const secret = await enableTotp(support.id);
    const login = await loginWithTotp(support, secret);

    const res = await login.client.post("/2fa/disable", {
      token: login.body.accessToken,
      body: { code: await freshTotp(support.id, secret) },
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("TWO_FACTOR_MANDATORY");
  });

  it("blocks every request from a team session that has no confirmed 2FA", async () => {
    const support = await createUser({ role: "SUPPORT" });
    const token = await sessionTokenFor(support);
    const api = authApi();

    const blocked = await api.get("/sessions", { token });
    expect(blocked.status).toBe(403);
    expect(blocked.body.error.code).toBe("TWO_FACTOR_REQUIRED");

    expect((await api.get("/me", { token })).status).toBe(200);
    expect((await api.post("/2fa/setup", { token })).status).toBe(200);
  });
});
