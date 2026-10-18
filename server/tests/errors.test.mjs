import { describe, expect, it } from "vitest";
import request from "supertest";
import { createTestApp } from "./helpers/testApp.mjs";

const app = createTestApp();

describe("global error handling", () => {
  it("returns a French 404 for unknown routes", async () => {
    const res = await request(app).get("/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
    expect(res.body.error.message).toBe("Route introuvable");
  });

  it("returns AppError status, code and message", async () => {
    const res = await request(app).get("/app-error");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("SHOP_NOT_FOUND");
    expect(res.body.error.message).toBe("Boutique introuvable");
  });

  it("hides internal details on unexpected errors", async () => {
    const res = await request(app).get("/boom");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(res.body.error.message).toBe("Une erreur est survenue");
    expect(JSON.stringify(res.body)).not.toContain("secret internal detail");
  });

  it("returns 400 INVALID_JSON for malformed bodies", async () => {
    const res = await request(app)
      .post("/validated")
      .set("Content-Type", "application/json")
      .send("{bad json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_JSON");
  });

  it("includes a request id in every error", async () => {
    const res = await request(app).get("/app-error");
    expect(res.body.error.requestId).toBeTruthy();
    expect(res.headers["x-request-id"]).toBe(res.body.error.requestId);
  });
});

describe("request id", () => {
  it("keeps a valid incoming request id", async () => {
    const res = await request(app).get("/app-error").set("X-Request-Id", "abc12345-valid");
    expect(res.headers["x-request-id"]).toBe("abc12345-valid");
  });

  it("replaces an invalid incoming request id", async () => {
    const res = await request(app).get("/app-error").set("X-Request-Id", "bad id with spaces!");
    expect(res.headers["x-request-id"]).not.toBe("bad id with spaces!");
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("replaces an oversized incoming request id", async () => {
    const res = await request(app).get("/app-error").set("X-Request-Id", "a".repeat(200));
    expect(res.headers["x-request-id"]).toMatch(/^[0-9a-f-]{36}$/);
  });
});
