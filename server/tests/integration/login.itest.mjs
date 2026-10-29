import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  alertsFor,
  authApi,
  bootApp,
  createUser,
  jobsFor,
  lastCode,
  loginByEmailOtp,
  newDevice,
  prisma,
  resetState,
  shutdownApp,
  uniqueEmail,
  uniquePhone,
} from "./helpers/harness.mjs";

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

describe("login with an email code", () => {
  it("signs a known user in and flags the first device as new", async () => {
    const user = await createUser();
    const login = await loginByEmailOtp(user.email);

    expect(login.response.status).toBe(200);
    expect(login.body.user.id).toBe(user.id);
    expect(login.body.isNewDevice).toBe(true);
    expect(login.body.accessToken).toEqual(expect.any(String));
    expect(login.body.expiresIn).toBe(900);

    expect(await jobsFor(user.email, "email.login-alert")).toHaveLength(1);
    const events = await prisma().activityLog.findMany({ where: { userId: user.id } });
    expect(events.map((e) => e.event)).toEqual(
      expect.arrayContaining(["OTP_REQUESTED", "LOGIN_SUCCESS", "NEW_DEVICE"]),
    );
  });

  it("does not warn again on a device that is already known", async () => {
    const user = await createUser();
    const device = newDevice();
    await loginByEmailOtp(user.email, { device });
    const second = await loginByEmailOtp(user.email, { device });

    expect(second.body.isNewDevice).toBe(false);
    expect(await jobsFor(user.email, "email.login-alert")).toHaveLength(1);
  });

  it("offers to create an account when the email is unknown", async () => {
    const res = await authApi().post("/login/otp/request", {
      body: { email: uniqueEmail("nobody") },
    });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ACCOUNT_NOT_FOUND");
  });

  it("rejects a wrong code, records the failure and locks after five tries", async () => {
    const user = await createUser();
    const api = authApi();
    await api.post("/login/otp/request", { body: { email: user.email } });
    const code = await lastCode(user.email);
    const wrong = code === "000000" ? "111111" : "000000";
    const device = newDevice();

    for (let i = 0; i < 5; i += 1) {
      const res = await api.post("/login/otp/verify", {
        body: { email: user.email, code: wrong, device },
      });
      expect(res.status).toBe(400);
    }
    const locked = await api.post("/login/otp/verify", {
      body: { email: user.email, code, device },
    });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("OTP_ATTEMPTS_EXCEEDED");

    const failures = await prisma().activityLog.count({
      where: { userId: user.id, event: "LOGIN_FAILED" },
    });
    expect(failures).toBeGreaterThanOrEqual(5);
  });

  it("never accepts the same code twice", async () => {
    const user = await createUser();
    const api = authApi();
    await api.post("/login/otp/request", { body: { email: user.email } });
    const code = await lastCode(user.email);
    const device = newDevice();

    expect(
      (await api.post("/login/otp/verify", { body: { email: user.email, code, device } })).status,
    ).toBe(200);
    expect(
      (await api.post("/login/otp/verify", { body: { email: user.email, code, device } })).status,
    ).toBe(400);
  });

  it("keeps suspended and banned accounts out", async () => {
    for (const status of ["SUSPENDED", "BANNED"]) {
      const user = await createUser({ status });
      const res = await authApi().post("/login/otp/request", { body: { email: user.email } });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
    }
  });

  it("sets cookies instead of returning tokens for the web", async () => {
    const user = await createUser();
    const login = await loginByEmailOtp(user.email, { device: newDevice("WEB") });

    expect(login.response.status).toBe(200);
    expect(login.body.accessToken).toBeUndefined();
    const cookies = login.response.headers["set-cookie"].join(";");
    expect(cookies).toContain("__Host-swg_access=");
    expect(cookies).toContain("swg_refresh=");
    expect(cookies).toMatch(/HttpOnly/i);
  });
});

describe("login with a phone code", () => {
  it("sends an SMS and signs the user in", async () => {
    const phone = uniquePhone();
    const user = await createUser({ phone, email: null });
    const api = authApi();

    const request = await api.post("/login/otp/request", { body: { phone } });
    expect(request.body).toMatchObject({ method: "PHONE", target: phone });
    expect(await jobsFor(phone, "sms.otp")).toHaveLength(1);

    const verify = await api.post("/login/otp/verify", {
      body: { phone, code: await lastCode(phone), device: newDevice() },
    });
    expect(verify.status).toBe(200);
    expect(verify.body.user.id).toBe(user.id);
  });

  it("falls back to email when the SMS does not arrive", async () => {
    const phone = uniquePhone();
    const email = uniqueEmail();
    const user = await createUser({ phone, email });
    const api = authApi();

    const request = await api.post("/login/otp/request", { body: { phone, channel: "EMAIL" } });
    expect(request.status).toBe(200);
    expect(request.body.method).toBe("EMAIL");
    expect(request.body.target).toMatch(/^.\*\*\*@example\.com$/);
    expect(await jobsFor(phone, "sms.otp")).toHaveLength(0);

    const emailJobs = await jobsFor(email, "email.otp");
    expect(emailJobs).toHaveLength(1);

    const verify = await api.post("/login/otp/verify", {
      body: { phone, code: emailJobs[0].data.code, device: newDevice() },
    });
    expect(verify.status).toBe(200);
    expect(verify.body.user.id).toBe(user.id);
  });

  it("explains when the account has no email for the fallback", async () => {
    const phone = uniquePhone();
    await createUser({ phone, email: null });
    const res = await authApi().post("/login/otp/request", { body: { phone, channel: "EMAIL" } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CONTACT_NOT_AVAILABLE");
  });

  it("limits how many codes one contact can ask for in an hour", async () => {
    const user = await createUser();
    const api = authApi();
    let status = 200;
    for (let i = 0; i < 6 && status === 200; i += 1) {
      status = (await api.post("/login/otp/request", { body: { email: user.email } })).status;
    }
    expect(status).toBe(429);
  });
});

describe("password", () => {
  async function signedIn() {
    const user = await createUser();
    const login = await loginByEmailOtp(user.email);
    return { user, token: login.body.accessToken, client: login.client };
  }

  async function stepUp(client, token, user) {
    const res = await client.post("/step-up/otp", { token, body: {} });
    expect(res.status).toBe(200);
    return lastCode(user.email);
  }

  it("is created with a fresh code and then works for login", async () => {
    const { user, token, client } = await signedIn();
    const code = await stepUp(client, token, user);

    const created = await client.post("/password", {
      token,
      body: { password: "Secret123", code },
    });
    expect(created.status).toBe(201);
    expect(await alertsFor(user.email)).toHaveLength(1);

    const login = await authApi().post("/login/password", {
      body: { email: user.email, password: "Secret123", device: newDevice() },
    });
    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(user.id);

    const stored = await prisma().user.findUnique({ where: { id: user.id } });
    expect(stored.passwordHash).toMatch(/^scrypt\$/);
  });

  it("refuses to create a password without a valid code", async () => {
    const { token, client } = await signedIn();
    const res = await client.post("/password", {
      token,
      body: { password: "Secret123", code: "123456" },
    });
    expect(res.status).toBe(400);
  });

  it("answers the same way for a wrong password and an unknown email", async () => {
    const { user, token, client } = await signedIn();
    await client.post("/password", {
      token,
      body: { password: "Secret123", code: await stepUp(client, token, user) },
    });
    const device = newDevice();

    const wrong = await authApi().post("/login/password", {
      body: { email: user.email, password: "Wrong12345", device },
    });
    const unknown = await authApi().post("/login/password", {
      body: { email: uniqueEmail("ghost"), password: "Wrong12345", device },
    });
    expect(wrong.status).toBe(401);
    expect(unknown.status).toBe(401);
    expect(wrong.body.error.code).toBe(unknown.body.error.code);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it("locks password attempts from one address after repeated failures", async () => {
    const { user } = await signedIn();
    const api = authApi();
    const body = { email: user.email, password: "Wrong12345", device: newDevice() };

    for (let i = 0; i < 5; i += 1) {
      expect((await api.post("/login/password", { body })).status).toBe(401);
    }
    const locked = await api.post("/login/password", { body });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe("PASSWORD_LOCKED");
  });

  it("is changed with the current password and a code, keeping only the current session", async () => {
    const { user, token, client } = await signedIn();
    await client.post("/password", {
      token,
      body: { password: "Secret123", code: await stepUp(client, token, user) },
    });
    const other = await loginByEmailOtp(user.email);

    const changed = await client.put("/password", {
      token,
      body: {
        currentPassword: "Secret123",
        newPassword: "Another456",
        code: await stepUp(client, token, user),
      },
    });
    expect(changed.status).toBe(200);

    expect((await client.get("/me", { token })).status).toBe(200);
    expect((await client.get("/me", { token: other.body.accessToken })).status).toBe(401);
  });

  it("rejects a wrong current password", async () => {
    const { user, token, client } = await signedIn();
    await client.post("/password", {
      token,
      body: { password: "Secret123", code: await stepUp(client, token, user) },
    });
    const res = await client.put("/password", {
      token,
      body: {
        currentPassword: "Nope123456",
        newPassword: "Another456",
        code: await stepUp(client, token, user),
      },
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_CURRENT_PASSWORD");
  });

  it("can be removed while another way to sign in remains", async () => {
    const { user, token, client } = await signedIn();
    await client.post("/password", {
      token,
      body: { password: "Secret123", code: await stepUp(client, token, user) },
    });
    const removed = await client.post("/password/remove", {
      token,
      body: { code: await stepUp(client, token, user) },
    });
    expect(removed.status).toBe(200);
    const stored = await prisma().user.findUnique({ where: { id: user.id } });
    expect(stored.passwordHash).toBeNull();
  });
});

describe("forgotten password", () => {
  it("answers identically whether or not the account exists", async () => {
    const user = await createUser();
    const known = await authApi().post("/password/forgot", { body: { email: user.email } });
    const unknown = await authApi().post("/password/forgot", {
      body: { email: uniqueEmail("ghost") },
    });

    expect(known.status).toBe(200);
    expect(known.body).toEqual(unknown.body);
    expect(await jobsFor(user.email, "email.otp")).toHaveLength(1);
  });

  it("sets a new password with the emailed code and closes every session", async () => {
    const user = await createUser();
    const session = await loginByEmailOtp(user.email);
    const token = session.body.accessToken;

    const api = authApi();
    await api.post("/password/forgot", { body: { email: user.email } });
    const reset = await api.post("/password/reset", {
      body: { email: user.email, code: await lastCode(user.email), newPassword: "Brandnew789" },
    });
    expect(reset.status).toBe(200);

    expect((await api.get("/me", { token })).status).toBe(401);
    const login = await api.post("/login/password", {
      body: { email: user.email, password: "Brandnew789", device: newDevice() },
    });
    expect(login.status).toBe(200);
  });

  it("refuses a wrong reset code", async () => {
    const user = await createUser();
    const api = authApi();
    await api.post("/password/forgot", { body: { email: user.email } });
    const res = await api.post("/password/reset", {
      body: { email: user.email, code: "000000", newPassword: "Brandnew789" },
    });
    expect(res.status).toBe(400);
  });
});
