import { describe, expect, it } from "vitest";
import request from "supertest";
import { createRequire } from "node:module";
import { createTestApp } from "./helpers/testApp.mjs";

const require = createRequire(import.meta.url);
const { isValidDrcPhone } = require("../src/core/validation/phone");

const app = createTestApp();

describe("validate middleware", () => {
  it("accepts valid input and normalizes the email", async () => {
    const res = await request(app)
      .post("/validated")
      .send({ email: "  Test@Example.COM ", phone: "+243893039790", age: 20 });
    expect(res.status).toBe(200);
    expect(res.body.body.email).toBe("test@example.com");
  });

  it("returns every validation error in French with 422", async () => {
    const res = await request(app)
      .post("/validated")
      .send({ email: "not-an-email", phone: "0893039790", age: 10 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toBe("Données invalides");
    const fields = res.body.error.details.map((d) => d.field).sort();
    expect(fields).toEqual(["age", "email", "phone"]);
    const phone = res.body.error.details.find((d) => d.field === "phone");
    expect(phone.message).toContain("+243XXXXXXXXX");
  });

  it("returns 422 when the body is missing", async () => {
    const res = await request(app).post("/validated");
    expect(res.status).toBe(422);
  });

  it("validates params and applies query defaults", async () => {
    const res = await request(app).get("/items/3f2b8c1e-7a4d-4e0b-9f3a-1c2d3e4f5a6b");
    expect(res.status).toBe(200);
    expect(res.body.query).toEqual({ page: 1, limit: 20 });
  });

  it("rejects a bad uuid and an out of range limit together", async () => {
    const res = await request(app).get("/items/abc?limit=500");
    expect(res.status).toBe(422);
    expect(res.body.error.details.length).toBeGreaterThanOrEqual(2);
  });
});

describe("DRC phone", () => {
  it.each(["+243893039790", "+243812345678"])("accepts %s", (phone) => {
    expect(isValidDrcPhone(phone)).toBe(true);
  });

  it.each(["0893039790", "+24389303979", "+2438930397901", "+250788123456", "", null, undefined])(
    "rejects %s",
    (phone) => {
      expect(isValidDrcPhone(phone)).toBe(false);
    },
  );
});
