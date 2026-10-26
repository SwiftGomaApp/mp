import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import {
  alertsFor,
  authApi,
  bootApp,
  createUser,
  enableTotp,
  jobsFor,
  lastCode,
  loginByEmailOtp,
  prisma,
  resetState,
  shutdownApp,
  uniqueEmail,
  uniquePhone,
} from "./helpers/harness.mjs";

const require = createRequire(import.meta.url);
const { hashBackupCode } = require("../../src/core/auth/backupCodes");

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

const DAY = 24 * 60 * 60 * 1000;

async function accountWithRecoveryContact(overrides = {}) {
  const recoveryEmail = uniqueEmail("recovery");
  const user = await createUser({
    email: uniqueEmail("owner"),
    phone: uniquePhone(),
    secondaryEmail: recoveryEmail,
    secondaryEmailVerifiedAt: new Date(),
    ...overrides,
  });
  return { user, recoveryEmail };
}

async function startRecovery({ user, recoveryEmail }, api = authApi()) {
  await api.post("/recovery/request", { body: { email: user.email, kind: "EMAIL" } });
  const verify = await api.post("/recovery/verify", {
    body: { email: user.email, kind: "EMAIL", code: await lastCode(recoveryEmail) },
  });
  return { api, verify, token: verify.body.recoveryToken };
}

async function makeAvailable(userId) {
  await prisma().accountRecoveryRequest.updateMany({
    where: { userId, status: "PENDING" },
    data: { availableAt: new Date(Date.now() - 1000) },
  });
}

describe("starting a recovery", () => {
  it("sends a code to the recovery contact", async () => {
    const account = await accountWithRecoveryContact();
    const res = await authApi().post("/recovery/request", {
      body: { email: account.user.email, kind: "EMAIL" },
    });

    expect(res.status).toBe(200);
    expect(await jobsFor(account.recoveryEmail, "email.otp")).toHaveLength(1);
    expect(await jobsFor(account.user.email, "email.otp")).toHaveLength(0);
  });

  it("answers the same way when nothing can be sent", async () => {
    const withContact = await accountWithRecoveryContact();
    const withoutContact = await createUser();
    const known = await authApi().post("/recovery/request", {
      body: { email: withContact.user.email },
    });
    const noContact = await authApi().post("/recovery/request", {
      body: { email: withoutContact.email },
    });
    const unknown = await authApi().post("/recovery/request", {
      body: { email: uniqueEmail("ghost") },
    });

    expect(noContact.body).toEqual(known.body);
    expect(unknown.body).toEqual(known.body);
    expect(await jobsFor(withoutContact.email, "email.otp")).toHaveLength(0);
  });

  it("is not available to the team", async () => {
    const recoveryEmail = uniqueEmail("recovery");
    const support = await createUser({
      role: "SUPPORT",
      secondaryEmail: recoveryEmail,
      secondaryEmailVerifiedAt: new Date(),
    });
    await authApi().post("/recovery/request", { body: { email: support.email } });
    expect(await jobsFor(recoveryEmail, "email.otp")).toHaveLength(0);
  });

  it("opens a 24-hour waiting period and warns every primary contact", async () => {
    const account = await accountWithRecoveryContact();
    const { verify } = await startRecovery(account);

    expect(verify.status).toBe(200);
    expect(verify.body.recoveryToken).toEqual(expect.any(String));
    const wait = new Date(verify.body.availableAt).getTime() - Date.now();
    expect(wait).toBeGreaterThan(DAY - 60_000);
    expect(wait).toBeLessThanOrEqual(DAY);

    const request = await prisma().accountRecoveryRequest.findFirst({
      where: { userId: account.user.id },
    });
    expect(request.status).toBe("PENDING");

    const emailAlert = await alertsFor(account.user.email);
    const smsAlert = await alertsFor(account.user.phone);
    expect(emailAlert[0].data.type).toBe("RECOVERY_REQUESTED");
    expect(smsAlert[0].data.type).toBe("RECOVERY_REQUESTED");
  });

  it("rejects a wrong code", async () => {
    const account = await accountWithRecoveryContact();
    await authApi().post("/recovery/request", { body: { email: account.user.email } });
    const res = await authApi().post("/recovery/verify", {
      body: { email: account.user.email, code: "000000" },
    });
    expect(res.status).toBe(400);
    expect(await prisma().accountRecoveryRequest.count()).toBe(0);
  });

  it("replaces an earlier pending request", async () => {
    const account = await accountWithRecoveryContact();
    const first = await startRecovery(account);
    const second = await startRecovery(account);
    await makeAvailable(account.user.id);

    const old = await first.api.post("/recovery/contact", {
      body: { token: first.token, kind: "EMAIL", value: uniqueEmail("new") },
    });
    expect(old.status).toBe(400);
    expect(old.body.error.code).toBe("RECOVERY_INVALID");

    const current = await second.api.post("/recovery/contact", {
      body: { token: second.token, kind: "EMAIL", value: uniqueEmail("new") },
    });
    expect(current.status).toBe(200);
  });
});

describe("finishing a recovery", () => {
  it("makes the owner wait before a new contact can be added", async () => {
    const account = await accountWithRecoveryContact();
    const { api, token } = await startRecovery(account);

    const res = await api.post("/recovery/contact", {
      body: { token, kind: "EMAIL", value: uniqueEmail("new") },
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("RECOVERY_WAITING");
    expect(res.body.error.details.availableAt).toEqual(expect.any(String));
  });

  it("replaces the primary contact, closes sessions and deletes the password", async () => {
    const account = await accountWithRecoveryContact({
      passwordHash: "scrypt$16384$8$1$c2FsdA==$aGFzaA==",
    });
    const session = await loginByEmailOtp(account.user.email);
    await prisma().passkey.create({
      data: {
        userId: account.user.id,
        name: "Phone",
        credentialId: "cred-1",
        publicKey: "key",
      },
    });

    const { api, token } = await startRecovery(account);
    await makeAvailable(account.user.id);

    const newEmail = uniqueEmail("fresh");
    const contact = await api.post("/recovery/contact", {
      body: { token, kind: "EMAIL", value: newEmail },
    });
    expect(contact.status).toBe(200);

    const done = await api.post("/recovery/complete", {
      body: { token, kind: "EMAIL", value: newEmail, code: await lastCode(newEmail) },
    });
    expect(done.status).toBe(200);
    expect(done.body.recovered).toBe(true);

    const stored = await prisma().user.findUnique({ where: { id: account.user.id } });
    expect(stored.email).toBe(newEmail);
    expect(stored.passwordHash).toBeNull();
    expect(
      (await prisma().passkey.findFirst({ where: { userId: account.user.id } })).revokedAt,
    ).not.toBeNull();
    expect((await api.get("/me", { token: session.body.accessToken })).status).toBe(401);

    const request = await prisma().accountRecoveryRequest.findFirst({
      where: { userId: account.user.id },
    });
    expect(request.status).toBe("COMPLETED");

    const alerts = await alertsFor(account.user.email);
    expect(alerts.map((a) => a.data.type)).toContain("RECOVERY_COMPLETED");

    const login = await loginByEmailOtp(newEmail);
    expect(login.response.status).toBe(200);
    expect(login.body.user.id).toBe(account.user.id);
  });

  it("does not let the same token be used twice", async () => {
    const account = await accountWithRecoveryContact();
    const { api, token } = await startRecovery(account);
    await makeAvailable(account.user.id);
    const newEmail = uniqueEmail("fresh");
    await api.post("/recovery/contact", { body: { token, kind: "EMAIL", value: newEmail } });
    await api.post("/recovery/complete", {
      body: { token, kind: "EMAIL", value: newEmail, code: await lastCode(newEmail) },
    });

    const again = await api.post("/recovery/contact", {
      body: { token, kind: "EMAIL", value: uniqueEmail("another") },
    });
    expect(again.status).toBe(400);
  });

  it("refuses a contact that already belongs to an account", async () => {
    const account = await accountWithRecoveryContact();
    const other = await createUser();
    const { api, token } = await startRecovery(account);
    await makeAvailable(account.user.id);

    const res = await api.post("/recovery/contact", {
      body: { token, kind: "EMAIL", value: other.email },
    });
    expect(res.status).toBe(409);
  });

  it("refuses a wrong code for the new contact", async () => {
    const account = await accountWithRecoveryContact();
    const { api, token } = await startRecovery(account);
    await makeAvailable(account.user.id);
    const newEmail = uniqueEmail("fresh");
    await api.post("/recovery/contact", { body: { token, kind: "EMAIL", value: newEmail } });

    const res = await api.post("/recovery/complete", {
      body: { token, kind: "EMAIL", value: newEmail, code: "000000" },
    });
    expect(res.status).toBe(400);
    const stored = await prisma().user.findUnique({ where: { id: account.user.id } });
    expect(stored.email).toBe(account.user.email);
  });

  it("expires after the completion window", async () => {
    const account = await accountWithRecoveryContact();
    const { api, token } = await startRecovery(account);
    await prisma().accountRecoveryRequest.updateMany({
      where: { userId: account.user.id },
      data: { availableAt: new Date(Date.now() - 2000), expiresAt: new Date(Date.now() - 1000) },
    });

    const res = await api.post("/recovery/contact", {
      body: { token, kind: "EMAIL", value: uniqueEmail("late") },
    });
    expect(res.status).toBe(400);
    const request = await prisma().accountRecoveryRequest.findFirst({
      where: { userId: account.user.id },
    });
    expect(request.status).toBe("EXPIRED");
  });
});

describe("accounts with two-step verification", () => {
  async function protectedAccount() {
    const account = await accountWithRecoveryContact();
    await enableTotp(account.user.id);
    const backupCode = "ABCDE-FGHJK";
    await prisma().backupCode.create({
      data: { userId: account.user.id, codeHash: hashBackupCode(backupCode) },
    });
    return { ...account, backupCode };
  }

  it("requires a backup code to finish", async () => {
    const account = await protectedAccount();
    const { api, token } = await startRecovery(account);
    await makeAvailable(account.user.id);
    const newEmail = uniqueEmail("fresh");
    await api.post("/recovery/contact", { body: { token, kind: "EMAIL", value: newEmail } });

    const res = await api.post("/recovery/complete", {
      body: { token, kind: "EMAIL", value: newEmail, code: await lastCode(newEmail) },
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("RECOVERY_BACKUP_CODE_REQUIRED");
  });

  it("finishes with a valid backup code and uses it up", async () => {
    const account = await protectedAccount();
    const { api, token } = await startRecovery(account);
    await makeAvailable(account.user.id);
    const newEmail = uniqueEmail("fresh");
    await api.post("/recovery/contact", { body: { token, kind: "EMAIL", value: newEmail } });

    const res = await api.post("/recovery/complete", {
      body: {
        token,
        kind: "EMAIL",
        value: newEmail,
        code: await lastCode(newEmail),
        backupCode: account.backupCode,
      },
    });
    expect(res.status).toBe(200);
    const used = await prisma().backupCode.findFirst({ where: { userId: account.user.id } });
    expect(used.usedAt).not.toBeNull();
    expect(
      (await prisma().totpCredential.findUnique({ where: { userId: account.user.id } }))
        .confirmedAt,
    ).not.toBeNull();
  });

  it("rejects a wrong backup code", async () => {
    const account = await protectedAccount();
    const { api, token } = await startRecovery(account);
    await makeAvailable(account.user.id);
    const newEmail = uniqueEmail("fresh");
    await api.post("/recovery/contact", { body: { token, kind: "EMAIL", value: newEmail } });

    const res = await api.post("/recovery/complete", {
      body: {
        token,
        kind: "EMAIL",
        value: newEmail,
        code: await lastCode(newEmail),
        backupCode: "ZZZZZ-ZZZZZ",
      },
    });
    expect(res.status).toBe(400);
    const stored = await prisma().user.findUnique({ where: { id: account.user.id } });
    expect(stored.email).toBe(account.user.email);
  });
});

describe("the owner stops a recovery", () => {
  it("shows the pending recovery on the security screen and cancels it", async () => {
    const account = await accountWithRecoveryContact();
    const { api, token } = await startRecovery(account);
    const owner = await loginByEmailOtp(account.user.email);
    const bearer = owner.body.accessToken;

    const before = await owner.client.get("/security", { token: bearer });
    expect(before.body.pendingRecovery).toMatchObject({ id: expect.any(String) });

    const cancel = await owner.client.post("/recovery/cancel", { token: bearer });
    expect(cancel.status).toBe(200);

    const after = await owner.client.get("/security", { token: bearer });
    expect(after.body.pendingRecovery).toBeNull();

    await makeAvailable(account.user.id);
    const blocked = await api.post("/recovery/contact", {
      body: { token, kind: "EMAIL", value: uniqueEmail("new") },
    });
    expect(blocked.status).toBe(400);
    expect(
      await prisma().activityLog.count({
        where: { userId: account.user.id, event: "ACCOUNT_RECOVERY_CANCELLED" },
      }),
    ).toBe(1);
  });

  it("reports when nothing is pending", async () => {
    const user = await createUser();
    const owner = await loginByEmailOtp(user.email);
    const res = await owner.client.post("/recovery/cancel", { token: owner.body.accessToken });
    expect(res.status).toBe(404);
  });
});
