import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  authApi,
  bootApp,
  jobsFor,
  lastCode,
  newDevice,
  prisma,
  resetState,
  rootApi,
  shutdownApp,
  signupByEmail,
  uniqueEmail,
  uniquePhone,
} from "./helpers/harness.mjs";

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

describe("health", () => {
  it("reports the database and Redis as up", async () => {
    const res = await rootApi().get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", database: "up", redis: "up" });
  });
});

describe("signup by email", () => {
  it("creates an active account after the emailed code is confirmed", async () => {
    const { email, tokens, response } = await signupByEmail({ role: "SELLER" });

    expect(response.status).toBe(200);
    expect(tokens.user).toMatchObject({ email, role: "SELLER", status: "ACTIVE" });
    expect(tokens.accessToken).toEqual(expect.any(String));
    expect(tokens.expiresIn).toBe(900);
    expect(tokens.refreshToken).toEqual(expect.any(String));

    const user = await prisma().user.findUnique({ where: { email } });
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.termsVersion).toBe("1.0");
    expect(user.ageConfirmedAt).not.toBeNull();
  });

  it("sends a welcome email and a new device alert", async () => {
    const { email } = await signupByEmail();
    expect(await jobsFor(email, "email.welcome")).toHaveLength(1);
    expect(await jobsFor(email, "email.login-alert")).toHaveLength(1);
  });

  it("lets a rider sign up on their own", async () => {
    const { tokens } = await signupByEmail({ role: "RIDER" });
    expect(tokens.user.role).toBe("RIDER");
    const me = await authApi().get("/me", { token: tokens.accessToken });
    expect(me.body.user.verificationStatus).toBe("NOT_SUBMITTED");
  });

  it("refuses to create team accounts by public signup", async () => {
    const res = await authApi().post("/signup/email", {
      body: {
        name: "Sneaky",
        email: uniqueEmail(),
        role: "ADMIN",
        acceptTerms: true,
        confirmAge: true,
      },
    });
    expect(res.status).toBe(422);
  });

  it("requires the terms and the age confirmation", async () => {
    const res = await authApi().post("/signup/email", {
      body: {
        name: "No Terms",
        email: uniqueEmail(),
        role: "BUYER",
        acceptTerms: false,
        confirmAge: true,
      },
    });
    expect(res.status).toBe(422);
  });

  it("rejects a wrong code and a replayed code", async () => {
    const email = uniqueEmail();
    const api = authApi();
    await api.post("/signup/email", {
      body: { name: "Person", email, role: "BUYER", acceptTerms: true, confirmAge: true },
    });
    const code = await lastCode(email);
    const device = newDevice();

    const wrong = await api.post("/signup/verify", {
      body: { email, code: code === "000000" ? "111111" : "000000", device },
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.error.code).toBe("OTP_INVALID");

    const ok = await api.post("/signup/verify", { body: { email, code, device } });
    expect(ok.status).toBe(200);

    const replay = await api.post("/signup/verify", { body: { email, code, device } });
    expect(replay.status).toBe(400);
  });

  it("refuses an email that already has an account", async () => {
    const { email } = await signupByEmail();
    const again = await authApi().post("/signup/email", {
      body: { name: "Again", email, role: "BUYER", acceptTerms: true, confirmAge: true },
    });
    expect(again.status).toBe(409);
    expect(again.body.error.code).toBe("ACCOUNT_EXISTS");
  });

  it("lets an unfinished signup start over with the same email", async () => {
    const email = uniqueEmail();
    const api = authApi();
    const body = { name: "Retry", email, role: "BUYER", acceptTerms: true, confirmAge: true };
    expect((await api.post("/signup/email", { body })).status).toBe(201);
    expect((await api.post("/signup/email", { body })).status).toBe(201);
    const users = await prisma().user.count({ where: { email } });
    expect(users).toBe(1);
  });
});

describe("signup by phone", () => {
  it("confirms the number with an SMS code", async () => {
    const phone = uniquePhone();
    const api = authApi();
    const start = await api.post("/signup/phone", {
      body: { name: "Phone Person", phone, role: "BUYER", acceptTerms: true, confirmAge: true },
    });
    expect(start.status).toBe(201);
    expect(start.body.method).toBe("PHONE");

    const verify = await api.post("/signup/verify", {
      body: { phone, code: await lastCode(phone), device: newDevice() },
    });
    expect(verify.status).toBe(200);
    expect(verify.body.user.phone).toBe(phone);
  });

  it("only accepts numbers from the DRC", async () => {
    const res = await authApi().post("/signup/phone", {
      body: {
        name: "Foreign",
        phone: "+33612345678",
        role: "BUYER",
        acceptTerms: true,
        confirmAge: true,
      },
    });
    expect(res.status).toBe(422);
  });
});
