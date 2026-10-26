import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  authApi,
  bootApp,
  createUser,
  loginByEmailOtp,
  newDevice,
  prisma,
  resetState,
  shutdownApp,
} from "./helpers/harness.mjs";

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

const DAY = 24 * 60 * 60 * 1000;

async function signedIn() {
  const user = await createUser();
  const login = await loginByEmailOtp(user.email, { device: newDevice() });
  return { user, token: login.body.accessToken, client: login.client };
}

describe("account activity", () => {
  it("lists logins and new devices, newest first, without internal events", async () => {
    const { token, client } = await signedIn();
    const res = await client.get("/activity", { token });

    expect(res.status).toBe(200);
    const events = res.body.items.map((item) => item.event);
    expect(events).toEqual(expect.arrayContaining(["LOGIN_SUCCESS", "NEW_DEVICE"]));
    expect(events).not.toContain("OTP_REQUESTED");
    expect(res.body).toMatchObject({ page: 1, limit: 20 });
    expect(res.body.total).toBe(res.body.items.length);

    const times = res.body.items.map((item) => new Date(item.createdAt).getTime());
    expect([...times].sort((a, b) => b - a)).toEqual(times);
  });

  it("shows the device and method but never the IP address", async () => {
    const { token, client } = await signedIn();
    const res = await client.get("/activity", { token, query: undefined });
    const login = res.body.items.find((item) => item.event === "LOGIN_SUCCESS");

    expect(login).toMatchObject({ method: "EMAIL_OTP", platform: "ANDROID", success: true });
    expect(login.deviceName).toEqual(expect.any(String));
    expect(login).not.toHaveProperty("ipAddress");
    expect(login).not.toHaveProperty("userAgent");
    expect(login).not.toHaveProperty("metadata");
  });

  it("filters by category", async () => {
    const { user, token, client } = await signedIn();
    await prisma().activityLog.create({ data: { userId: user.id, event: "PASSWORD_CHANGED" } });

    const security = await client.get("/activity?category=SECURITY", { token });
    expect(security.body.items.map((item) => item.event)).toEqual(["PASSWORD_CHANGED"]);

    const devices = await client.get("/activity?category=DEVICE", { token });
    expect(devices.body.items.every((item) => item.event === "NEW_DEVICE")).toBe(true);
  });

  it("only goes back 90 days", async () => {
    const { user, token, client } = await signedIn();
    await prisma().activityLog.create({
      data: {
        userId: user.id,
        event: "PASSWORD_CHANGED",
        createdAt: new Date(Date.now() - 100 * DAY),
      },
    });
    const res = await client.get("/activity?category=SECURITY", { token });
    expect(res.body.items).toHaveLength(0);
  });

  it("keeps other people's activity private", async () => {
    const mine = await signedIn();
    const other = await createUser();
    await prisma().activityLog.create({ data: { userId: other.id, event: "LOGIN_SUCCESS" } });

    const res = await mine.client.get("/activity", { token: mine.token });
    expect(res.body.items.every((item) => item.event !== undefined)).toBe(true);
    expect(res.body.total).toBe(
      await prisma().activityLog.count({
        where: {
          userId: mine.user.id,
          event: {
            in: [
              "LOGIN_SUCCESS",
              "NEW_DEVICE",
              "LOGIN_FAILED",
              "SIGNUP_COMPLETED",
              "ACCOUNT_LOCKED",
            ],
          },
        },
      }),
    );
  });

  it("paginates and validates the query", async () => {
    const { user, token, client } = await signedIn();
    for (let i = 0; i < 5; i += 1) {
      await prisma().activityLog.create({
        data: { userId: user.id, event: "LOGIN_FAILED", success: false },
      });
    }
    const page = await client.get("/activity?limit=2&page=2", { token });
    expect(page.body.items).toHaveLength(2);
    expect(page.body.page).toBe(2);
    expect(page.body.total).toBeGreaterThanOrEqual(7);

    expect((await client.get("/activity?category=NOPE", { token })).status).toBe(422);
    expect((await client.get("/activity?limit=500", { token })).status).toBe(422);
  });

  it("needs a session", async () => {
    expect((await authApi().get("/activity")).status).toBe(401);
  });
});
