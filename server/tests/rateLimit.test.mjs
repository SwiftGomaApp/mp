import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { MemoryStore } = require("express-rate-limit");
const {
  createOtpLimiters,
  normalizeTarget,
} = require("../src/core/middlewares/rateLimit.middleware");
const { requestId } = require("../src/core/middlewares/requestId.middleware");
const { errorHandler } = require("../src/core/middlewares/error.middleware");

function createApp() {
  const app = express();
  app.use(requestId);
  app.use(express.json());
  app.post("/otp", ...createOtpLimiters({ createStore: () => new MemoryStore() }), (req, res) =>
    res.json({ ok: true }),
  );
  app.use(errorHandler);
  return app;
}

function phone(index) {
  return `+24389000${String(index).padStart(4, "0")}`;
}

describe("OTP rate limiting", () => {
  it("allows 5 requests per target then blocks with a French 429", async () => {
    const app = createApp();

    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).post("/otp").send({ phone: "+243893039790" });
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).post("/otp").send({ phone: "+243893039790" });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("TOO_MANY_REQUESTS");
    expect(blocked.body.error.message).toBe("Trop de codes demandés, veuillez réessayer plus tard");
  });

  it("does not block a different target while one target is limited", async () => {
    const app = createApp();

    for (let i = 0; i < 6; i += 1) {
      await request(app).post("/otp").send({ phone: "+243893039790" });
    }

    const other = await request(app).post("/otp").send({ phone: "+243893039791" });
    expect(other.status).toBe(200);
  });

  it("limits one IP across many different phone numbers (SMS pumping)", async () => {
    const app = createApp();

    for (let i = 0; i < 10; i += 1) {
      const res = await request(app)
        .post("/otp")
        .send({ phone: phone(i) });
      expect(res.status).toBe(200);
    }

    const blocked = await request(app)
      .post("/otp")
      .send({ phone: phone(99) });
    expect(blocked.status).toBe(429);
  });

  it("treats spaces and letter case as the same target", async () => {
    const app = createApp();

    const variants = [
      "+243 893 039 790",
      "+243893039790",
      "+243 893039790",
      "+243893 039790",
      " +243893039790 ",
    ];
    for (const value of variants) {
      const res = await request(app).post("/otp").send({ phone: value });
      expect(res.status).toBe(200);
    }

    const blocked = await request(app).post("/otp").send({ phone: "+243893039790" });
    expect(blocked.status).toBe(429);
  });
});

describe("normalizeTarget", () => {
  it("lowercases emails and strips whitespace", () => {
    expect(normalizeTarget({ body: { email: " Test@Example.COM " }, ip: "1.2.3.4" })).toBe(
      "test@example.com",
    );
  });

  it("falls back to the IP when no target is given", () => {
    expect(normalizeTarget({ body: {}, ip: "1.2.3.4" })).toBe("1.2.3.4");
  });
});
