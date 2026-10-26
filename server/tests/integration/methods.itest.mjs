import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  alertsFor,
  authApi,
  bootApp,
  createUser,
  enableTotp,
  freshTotp,
  loginByEmailOtp,
  loginWithTotp,
  prisma,
  resetState,
  shutdownApp,
  stepUpCode,
  uniqueEmail,
  uniquePhone,
} from "./helpers/harness.mjs";

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

async function signedIn(overrides) {
  const user = await createUser(overrides);
  const login = await loginByEmailOtp(user.email);
  return { user, token: login.body.accessToken, client: login.client };
}

async function removeMethod(session, method) {
  return session.client.post(`/methods/${method}/remove`, {
    token: session.token,
    body: { code: await stepUpCode(session.client, session.token, session.user) },
  });
}

async function linkGoogle(userId) {
  return prisma().oAuthAccount.create({
    data: {
      userId,
      provider: "GOOGLE",
      providerAccountId: `google-${userId}`,
      email: "linked@example.com",
      emailVerifiedAt: new Date(),
    },
  });
}

describe("sign-in methods list", () => {
  it("shows everything linked to the account", async () => {
    const phone = uniquePhone();
    const session = await signedIn({ email: uniqueEmail(), phone });
    await linkGoogle(session.user.id);

    const res = await session.client.get("/methods", { token: session.token });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      email: { value: session.user.email, verified: true },
      phone: { value: phone, verified: true },
      password: false,
      google: { email: "linked@example.com" },
      apple: null,
      passkeys: 0,
    });
  });

  it("needs a session", async () => {
    expect((await authApi().get("/methods")).status).toBe(401);
  });
});

describe("removing a way to sign in", () => {
  it("removes Google while another method remains, and tells the owner", async () => {
    const session = await signedIn();
    await linkGoogle(session.user.id);

    const res = await removeMethod(session, "GOOGLE");
    expect(res.status).toBe(200);
    expect(res.body.google).toBeNull();

    expect(await prisma().oAuthAccount.count({ where: { userId: session.user.id } })).toBe(0);
    expect(
      await prisma().activityLog.count({
        where: { userId: session.user.id, event: "LOGIN_METHOD_REMOVED" },
      }),
    ).toBe(1);
    const alerts = await alertsFor(session.user.email);
    expect(alerts.map((a) => a.data.type)).toContain("LOGIN_METHOD_REMOVED");
  });

  it("never removes the last way to sign in", async () => {
    const session = await signedIn();
    const res = await removeMethod(session, "EMAIL");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("LAST_LOGIN_METHOD");
    const stored = await prisma().user.findUnique({ where: { id: session.user.id } });
    expect(stored.email).toBe(session.user.email);
  });

  it("removes the phone, then refuses to remove the email that is left", async () => {
    const session = await signedIn({ email: uniqueEmail(), phone: uniquePhone() });

    const phone = await removeMethod(session, "PHONE");
    expect(phone.status).toBe(200);
    expect(phone.body.phone).toBeNull();

    const email = await removeMethod(session, "EMAIL");
    expect(email.status).toBe(403);
    expect(email.body.error.code).toBe("LAST_LOGIN_METHOD");
  });

  it("removes the email when the phone can still be used, alerting the phone", async () => {
    const phone = uniquePhone();
    const session = await signedIn({ email: uniqueEmail(), phone });

    const res = await removeMethod(session, "EMAIL");
    expect(res.status).toBe(200);
    expect(res.body.email).toBeNull();

    const alerts = await alertsFor(phone);
    expect(alerts.map((a) => a.data.type)).toContain("LOGIN_METHOD_REMOVED");

    const request = await authApi().post("/login/otp/request", { body: { phone } });
    expect(request.status).toBe(200);
  });

  it("keeps at least one verified contact for codes and alerts", async () => {
    const session = await signedIn();
    await linkGoogle(session.user.id);

    const res = await removeMethod(session, "EMAIL");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("LAST_CONTACT");
  });

  it("does not let the team remove their email", async () => {
    const support = await createUser({
      role: "SUPPORT",
      phone: uniquePhone(),
      email: uniqueEmail("support"),
    });
    const secret = await enableTotp(support.id);
    const login = await loginWithTotp(support, secret);

    const res = await login.client.post("/methods/EMAIL/remove", {
      token: login.body.accessToken,
      body: { code: await freshTotp(support.id, secret) },
    });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("STAFF_EMAIL_REQUIRED");
  });

  it("says so when the method is not linked", async () => {
    const session = await signedIn();
    const res = await removeMethod(session, "APPLE");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("METHOD_NOT_FOUND");
  });

  it("needs a valid fresh code", async () => {
    const session = await signedIn();
    await linkGoogle(session.user.id);
    const res = await session.client.post("/methods/GOOGLE/remove", {
      token: session.token,
      body: { code: "123456" },
    });
    expect(res.status).toBe(400);
    expect(await prisma().oAuthAccount.count({ where: { userId: session.user.id } })).toBe(1);
  });

  it("rejects methods that are managed elsewhere", async () => {
    const session = await signedIn();
    const res = await session.client.post("/methods/PASSWORD/remove", {
      token: session.token,
      body: { code: "123456" },
    });
    expect(res.status).toBe(422);
  });
});

describe("security checklist", () => {
  it("reports what is missing and what is done", async () => {
    const session = await signedIn();
    const before = await session.client.get("/security", { token: session.token });
    const done = (res) => Object.fromEntries(res.body.items.map((item) => [item.key, item.done]));

    expect(done(before)).toEqual({
      EMAIL_VERIFIED: true,
      PHONE_VERIFIED: false,
      RECOVERY_CONTACT: false,
      TWO_FACTOR: false,
      PASSKEY: false,
    });
    expect(before.body.pendingRecovery).toBeNull();

    await prisma().user.update({
      where: { id: session.user.id },
      data: {
        phone: uniquePhone(),
        phoneVerifiedAt: new Date(),
        secondaryEmail: uniqueEmail("recovery"),
        secondaryEmailVerifiedAt: new Date(),
      },
    });
    await enableTotp(session.user.id);
    await prisma().passkey.create({
      data: { userId: session.user.id, name: "Phone", credentialId: "cred-x", publicKey: "key" },
    });

    const after = await session.client.get("/security", { token: session.token });
    expect(done(after)).toEqual({
      EMAIL_VERIFIED: true,
      PHONE_VERIFIED: true,
      RECOVERY_CONTACT: true,
      TWO_FACTOR: true,
      PASSKEY: true,
    });
  });

  it("needs a session", async () => {
    expect((await authApi().get("/security")).status).toBe(401);
  });
});
