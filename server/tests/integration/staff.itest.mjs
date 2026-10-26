import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  adminApi,
  alertsFor,
  authApi,
  bootApp,
  createAdminSession,
  createUser,
  enableTotp,
  freshTotp,
  jobsFor,
  loginWithTotp,
  newDevice,
  prisma,
  resetState,
  shutdownApp,
  totpCode,
  uniqueEmail,
} from "./helpers/harness.mjs";

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

async function createSupport(session, email = uniqueEmail("support")) {
  const res = await authApi().post("/staff", {
    token: session.token,
    body: {
      name: "Aline Mbula",
      email,
      code: await freshTotp(session.admin.id, session.secret),
    },
  });
  return { res, email };
}

async function setupToken(email) {
  const jobs = await jobsFor(email, "email.staff-setup");
  const last = jobs[jobs.length - 1];
  return new URL(last.data.setupUrl).searchParams.get("token");
}

describe("creating a Support account", () => {
  it("creates an active Support member and emails the setup link", async () => {
    const session = await createAdminSession();
    const { res, email } = await createSupport(session);

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ email, role: "SUPPORT", status: "ACTIVE" });

    const user = await prisma().user.findUnique({ where: { email } });
    expect(user.passwordHash).toBeNull();
    expect(user.emailVerifiedAt).not.toBeNull();

    const jobs = await jobsFor(email, "email.staff-setup");
    expect(jobs).toHaveLength(1);
    expect(jobs[0].data.setupUrl).toContain("token=");
    expect(jobs[0].data.expiresHours).toBe(72);

    const log = await prisma().activityLog.findFirst({
      where: { userId: user.id, event: "STAFF_ACCOUNT_CREATED" },
    });
    expect(log.metadata).toMatchObject({ actorId: session.admin.id });
  });

  it("needs a valid 2FA code from the Admin", async () => {
    const session = await createAdminSession();
    const res = await authApi().post("/staff", {
      token: session.token,
      body: { name: "Aline Mbula", email: uniqueEmail("support"), code: "000000" },
    });
    expect(res.status).toBe(400);
    expect(await prisma().user.count({ where: { role: "SUPPORT" } })).toBe(0);
  });

  it("refuses an email that is already used", async () => {
    const session = await createAdminSession();
    const existing = await createUser();
    const { res } = await createSupport(session, existing.email);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("ACCOUNT_EXISTS");
  });

  it("is reserved for the Admin", async () => {
    const support = await createUser({ role: "SUPPORT" });
    const secret = await enableTotp(support.id);
    const login = await loginWithTotp(support, secret);

    const res = await authApi().post("/staff", {
      token: login.body.accessToken,
      body: {
        name: "Other Person",
        email: uniqueEmail(),
        code: await freshTotp(support.id, secret),
      },
    });
    expect(res.status).toBe(403);
  });

  it("is refused to anonymous callers", async () => {
    const res = await authApi().post("/staff", {
      body: { name: "Other Person", email: uniqueEmail(), code: "123456" },
    });
    expect(res.status).toBe(401);
  });
});

describe("choosing a password from the link", () => {
  it("sets the password once, then forces 2FA enrollment at the first login", async () => {
    const session = await createAdminSession();
    const { email } = await createSupport(session);
    const token = await setupToken(email);
    const api = authApi();

    const weak = await api.post("/staff/setup", { body: { token, newPassword: "short" } });
    expect(weak.status).toBe(422);

    const set = await api.post("/staff/setup", { body: { token, newPassword: "Welcome2024" } });
    expect(set.status).toBe(200);

    const reuse = await api.post("/staff/setup", { body: { token, newPassword: "Another2024" } });
    expect(reuse.status).toBe(400);
    expect(reuse.body.error.code).toBe("STAFF_SETUP_INVALID");

    const login = await api.post("/login/password", {
      body: { email, password: "Welcome2024", device: newDevice() },
    });
    expect(login.status).toBe(202);
    expect(login.body).toMatchObject({ twoFactorRequired: true, enrollment: true });

    const setup = await api.post("/2fa/enroll/setup", {
      body: { challengeToken: login.body.challengeToken },
    });
    const confirm = await api.post("/2fa/enroll/confirm", {
      body: { challengeToken: login.body.challengeToken, code: totpCode(setup.body.secret) },
    });
    expect(confirm.status).toBe(200);
    expect(confirm.body.user.role).toBe("SUPPORT");
  });

  it("rejects an unknown token", async () => {
    const res = await authApi().post("/staff/setup", {
      body: { token: "z".repeat(43), newPassword: "Welcome2024" },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("STAFF_SETUP_INVALID");
  });

  it("sends a new link and cancels the old one", async () => {
    const session = await createAdminSession();
    const { email, res } = await createSupport(session);
    const oldToken = await setupToken(email);

    const resend = await authApi().post(`/staff/${res.body.id}/resend-setup`, {
      token: session.token,
      body: { code: await freshTotp(session.admin.id, session.secret) },
    });
    expect(resend.status).toBe(200);
    expect(await jobsFor(email, "email.staff-setup")).toHaveLength(2);

    const newToken = await setupToken(email);
    expect(newToken).not.toBe(oldToken);

    const api = authApi();
    expect(
      (await api.post("/staff/setup", { body: { token: oldToken, newPassword: "Welcome2024" } }))
        .status,
    ).toBe(400);
    expect(
      (await api.post("/staff/setup", { body: { token: newToken, newPassword: "Welcome2024" } }))
        .status,
    ).toBe(200);
  });

  it("does not resend once the password is set", async () => {
    const session = await createAdminSession();
    const { email, res } = await createSupport(session);
    await authApi().post("/staff/setup", {
      body: { token: await setupToken(email), newPassword: "Welcome2024" },
    });

    const resend = await authApi().post(`/staff/${res.body.id}/resend-setup`, {
      token: session.token,
      body: { code: await freshTotp(session.admin.id, session.secret) },
    });
    expect(resend.status).toBe(409);
    expect(resend.body.error.code).toBe("STAFF_SETUP_NOT_PENDING");
  });

  it("only resends for Support accounts", async () => {
    const session = await createAdminSession();
    const buyer = await createUser();
    const resend = await authApi().post(`/staff/${buyer.id}/resend-setup`, {
      token: session.token,
      body: { code: await freshTotp(session.admin.id, session.secret) },
    });
    expect(resend.status).toBe(404);
  });
});

describe("resetting a Support member's 2FA", () => {
  async function supportWithSession() {
    const support = await createUser({ role: "SUPPORT", email: uniqueEmail("support") });
    const secret = await enableTotp(support.id);
    const login = await loginWithTotp(support, secret);
    return { support, secret, login };
  }

  it("removes the factor, closes their sessions and forces a new enrollment", async () => {
    const session = await createAdminSession();
    const { support, login } = await supportWithSession();

    const res = await authApi().post(`/staff/${support.id}/reset-2fa`, {
      token: session.token,
      body: {
        code: await freshTotp(session.admin.id, session.secret),
        reason: "Identité vérifiée par téléphone",
      },
    });
    expect(res.status).toBe(200);
    expect(res.body.twoFactorEnabled).toBe(false);

    expect(await prisma().totpCredential.count({ where: { userId: support.id } })).toBe(0);
    expect(await prisma().backupCode.count({ where: { userId: support.id } })).toBe(0);
    expect((await authApi().get("/me", { token: login.body.accessToken })).status).toBe(401);

    const log = await prisma().activityLog.findFirst({
      where: { userId: support.id, event: "TOTP_DISABLED" },
    });
    expect(log.metadata).toMatchObject({ actorId: session.admin.id, via: "admin-reset" });
    expect(await alertsFor(support.email)).toHaveLength(1);

    const next = await authApi().post("/login/otp/request", { body: { email: support.email } });
    expect(next.status).toBe(200);
  });

  it("requires the reason and the Admin's own code", async () => {
    const session = await createAdminSession();
    const { support } = await supportWithSession();

    const noReason = await authApi().post(`/staff/${support.id}/reset-2fa`, {
      token: session.token,
      body: { code: await freshTotp(session.admin.id, session.secret) },
    });
    expect(noReason.status).toBe(422);

    const badCode = await authApi().post(`/staff/${support.id}/reset-2fa`, {
      token: session.token,
      body: { code: "000000", reason: "Identité vérifiée" },
    });
    expect(badCode.status).toBe(400);
    expect(await prisma().totpCredential.count({ where: { userId: support.id } })).toBe(1);
  });

  it("cannot be used on the Admin or on other roles", async () => {
    const session = await createAdminSession();
    const buyer = await createUser();

    for (const id of [session.admin.id, buyer.id]) {
      const res = await authApi().post(`/staff/${id}/reset-2fa`, {
        token: session.token,
        body: {
          code: await freshTotp(session.admin.id, session.secret),
          reason: "Identité vérifiée",
        },
      });
      expect(res.status).toBe(404);
    }
  });

  it("says so when the member has no 2FA to reset", async () => {
    const session = await createAdminSession();
    const support = await createUser({ role: "SUPPORT" });
    const res = await authApi().post(`/staff/${support.id}/reset-2fa`, {
      token: session.token,
      body: {
        code: await freshTotp(session.admin.id, session.secret),
        reason: "Identité vérifiée",
      },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("TWO_FACTOR_NOT_ENABLED");
  });
});

describe("admin account actions", () => {
  it("suspends, bans and reactivates, logging every user out first", async () => {
    const session = await createAdminSession();
    const target = await createUser();
    const targetSession = await (
      await import("./helpers/harness.mjs")
    ).loginByEmailOtp(target.email);
    const api = adminApi();

    const suspend = await api.post(`/users/${target.id}/suspend`, {
      token: session.token,
      body: { reason: "Fraude suspectée" },
    });
    expect(suspend.status).toBe(200);
    expect(suspend.body.status).toBe("SUSPENDED");
    expect((await authApi().get("/me", { token: targetSession.body.accessToken })).status).toBe(
      401,
    );

    const reactivate = await api.post(`/users/${target.id}/reactivate`, {
      token: session.token,
      body: { reason: "Vérification terminée" },
    });
    expect(reactivate.body.status).toBe("ACTIVE");

    const ban = await api.post(`/users/${target.id}/ban`, {
      token: session.token,
      body: { reason: "Violations répétées" },
    });
    expect(ban.body.status).toBe("BANNED");
  });

  it("refuses to act on the Admin's own account and needs a reason", async () => {
    const session = await createAdminSession();
    const own = await adminApi().post(`/users/${session.admin.id}/suspend`, {
      token: session.token,
      body: { reason: "Test personnel" },
    });
    expect(own.status).toBe(403);

    const noReason = await adminApi().post(`/users/${session.admin.id}/suspend`, {
      token: session.token,
      body: {},
    });
    expect(noReason.status).toBe(422);
  });

  it("keeps the admin routes closed to everyone else", async () => {
    const buyer = await createUser();
    const token = await (await import("./helpers/harness.mjs")).sessionTokenFor(buyer);
    const res = await adminApi().post(`/users/${buyer.id}/suspend`, {
      token,
      body: { reason: "Essai interdit" },
    });
    expect(res.status).toBe(403);
  });
});
