import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  authApi,
  bootApp,
  createUser,
  loginByEmailOtp,
  resetState,
  rootApi,
  shutdownApp,
  uniqueEmail,
  uniquePhone,
} from "./helpers/harness.mjs";

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

describe("rate limits", () => {
  it("allows five code requests per contact per hour on the public routes", async () => {
    const user = await createUser();
    const api = authApi();
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await api.post("/login/otp/request", { body: { email: user.email } })).status);
    }
    expect(statuses.slice(0, 5)).toEqual([200, 200, 200, 200, 200]);
    expect(statuses[5]).toBe(429);
  });

  it("does not block another contact from the same address", async () => {
    const api = authApi();
    const first = await createUser();
    const second = await createUser();
    for (let i = 0; i < 6; i += 1) {
      await api.post("/login/otp/request", { body: { email: first.email } });
    }
    const other = await api.post("/login/otp/request", { body: { email: second.email } });
    expect(other.status).toBe(200);
  });

  it("limits the codes one address can request across many contacts", async () => {
    const api = authApi();
    let blocked = 0;
    for (let i = 0; i < 32; i += 1) {
      const res = await api.post("/signup/phone", {
        body: {
          name: "Pumper",
          phone: uniquePhone(),
          role: "BUYER",
          acceptTerms: true,
          confirmAge: true,
        },
      });
      if (res.status === 429) blocked += 1;
    }
    expect(blocked).toBeGreaterThanOrEqual(2);
  });

  it("answers with the French message and a request id", async () => {
    const user = await createUser();
    const api = authApi();
    let res;
    for (let i = 0; i < 6; i += 1) {
      res = await api.post("/login/otp/request", { body: { email: user.email } });
    }
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(res.body.error.message).toMatch(/réessayer/);
    expect(res.body.error.requestId).toEqual(expect.any(String));
  });

  it("limits one address to 100 calls per route in 15 minutes", async () => {
    const api = authApi();
    let last;
    for (let i = 0; i < 101; i += 1) last = await api.post("/oauth/nonce");
    expect(last.status).toBe(429);
    expect(last.body.error.message).toMatch(/Trop de tentatives/);
  });

  it("limits one address to 120 calls per minute overall", async () => {
    const api = rootApi();
    let last;
    for (let i = 0; i < 121; i += 1) last = await api.get("/health");
    expect(last.status).toBe(429);
  });

  it("counts addresses separately", async () => {
    const busy = rootApi();
    for (let i = 0; i < 121; i += 1) await busy.get("/health");
    expect((await rootApi().get("/health")).status).toBe(200);
  });

  it("keeps the helpers independent of the limits", async () => {
    const user = await createUser({ email: uniqueEmail("free") });
    const login = await loginByEmailOtp(user.email);
    expect(login.response.status).toBe(200);
  });
});
