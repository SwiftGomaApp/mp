import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import {
  authApi,
  bootApp,
  createUser,
  enableTotp,
  loginByEmailOtp,
  loginWithTotp,
  newDevice,
  prisma,
  resetState,
  shutdownApp,
} from "./helpers/harness.mjs";

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

const ORIGIN = "http://localhost:3000";

async function signedIn(overrides) {
  const user = await createUser(overrides);
  const login = await loginByEmailOtp(user.email);
  return { user, ...login.body, client: login.client, device: login.device };
}

const cookieHeader = (response) =>
  response.headers["set-cookie"].map((cookie) => cookie.split(";")[0]).join("; ");

describe("access control", () => {
  it("asks for a token on protected routes", async () => {
    const res = await authApi().get("/me");
    expect(res.status).toBe(401);
  });

  it("rejects a garbage token", async () => {
    const res = await authApi().get("/me", { token: "not-a-token" });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
  });

  it("returns the profile of the signed-in user", async () => {
    const { user, accessToken, client } = await signedIn();
    const res = await client.get("/me", { token: accessToken });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      id: user.id,
      email: user.email,
      emailVerified: true,
      phoneVerified: false,
      hasPassword: false,
      twoFactorEnabled: false,
    });
  });
});

describe("refresh", () => {
  it("rotates the refresh token and issues a new access token", async () => {
    const { refreshToken, client } = await signedIn();
    const res = await client.post("/refresh", { body: { refreshToken } });

    expect(res.status).toBe(200);
    expect(res.body.refreshToken).not.toBe(refreshToken);
    expect((await client.get("/me", { token: res.body.accessToken })).status).toBe(200);
  });

  it("rejects an unknown refresh token", async () => {
    const res = await authApi().post("/refresh", { body: { refreshToken: "x".repeat(64) } });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("REFRESH_TOKEN_INVALID");
  });

  it("detects a stolen token that is replayed after the grace period", async () => {
    const { user, refreshToken, accessToken, client } = await signedIn();
    const first = await client.post("/refresh", { body: { refreshToken } });
    expect(first.status).toBe(200);

    await prisma().session.updateMany({
      where: { userId: user.id },
      data: { rotatedAt: new Date(Date.now() - 5 * 60 * 1000) },
    });

    const replay = await client.post("/refresh", { body: { refreshToken } });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("TOKEN_REUSED");

    const session = await prisma().session.findFirst({ where: { userId: user.id } });
    expect(session.revokedReason).toBe("TOKEN_REUSE");
    expect((await client.get("/me", { token: accessToken })).status).toBe(401);
    expect(
      await prisma().activityLog.count({
        where: { userId: user.id, event: "TOKEN_REUSE_DETECTED" },
      }),
    ).toBe(1);
  });

  it("tolerates a quick retry of the same token from the same client", async () => {
    const { refreshToken, client } = await signedIn();
    await client.post("/refresh", { body: { refreshToken } });
    const retry = await client.post("/refresh", { body: { refreshToken } });
    expect(retry.status).toBe(200);
  });

  it("refuses an expired session", async () => {
    const { user, refreshToken, client } = await signedIn();
    await prisma().session.updateMany({
      where: { userId: user.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    const res = await client.post("/refresh", { body: { refreshToken } });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SESSION_EXPIRED");
  });

  it("forces a new login after the maximum session lifetime", async () => {
    const { user, refreshToken, client } = await signedIn();
    await prisma().session.updateMany({
      where: { userId: user.id },
      data: { createdAt: new Date(Date.now() - 91 * 24 * 60 * 60 * 1000) },
    });
    const res = await client.post("/refresh", { body: { refreshToken } });
    expect(res.status).toBe(401);
  });

  it("logs out an idle team member on the web after 30 minutes", async () => {
    const support = await createUser({ role: "SUPPORT" });
    const secret = await enableTotp(support.id);
    const login = await loginWithTotp(support, secret);
    const refreshToken = login.body.refreshToken;

    await prisma().session.updateMany({
      where: { userId: support.id },
      data: { platform: "WEB", lastSeenAt: new Date(Date.now() - 31 * 60 * 1000) },
    });
    const res = await login.client.post("/refresh", { body: { refreshToken } });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("SESSION_EXPIRED");
  });

  it("stops refreshing once the account is suspended", async () => {
    const { user, refreshToken, client } = await signedIn();
    await prisma().user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    const res = await client.post("/refresh", { body: { refreshToken } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_SUSPENDED");
  });
});

describe("devices", () => {
  it("lists the connected devices and marks the current one", async () => {
    const { user, accessToken, client } = await signedIn();
    const other = await loginByEmailOtp(user.email);

    const res = await client.get("/sessions", { token: accessToken });
    expect(res.status).toBe(200);
    expect(res.body.sessions).toHaveLength(2);
    expect(res.body.sessions.filter((s) => s.current)).toHaveLength(1);
    expect(other.body.accessToken).toBeDefined();
  });

  it("disconnects the oldest device at the sixth login", async () => {
    const user = await createUser();
    const first = await loginByEmailOtp(user.email);
    for (let i = 0; i < 5; i += 1) await loginByEmailOtp(user.email);

    const active = await prisma().session.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(5);
    expect((await first.client.get("/me", { token: first.body.accessToken })).status).toBe(401);

    const evicted = await prisma().session.findFirst({
      where: { userId: user.id, revokedReason: "EVICTED" },
    });
    expect(evicted).not.toBeNull();
  });

  it("replaces the previous session when the same device signs in again", async () => {
    const user = await createUser();
    const device = newDevice();
    const first = await loginByEmailOtp(user.email, { device });
    await loginByEmailOtp(user.email, { device });

    const active = await prisma().session.count({ where: { userId: user.id, revokedAt: null } });
    expect(active).toBe(1);
    expect((await first.client.get("/me", { token: first.body.accessToken })).status).toBe(401);
  });

  it("disconnects one device without touching the others", async () => {
    const { user, accessToken, client } = await signedIn();
    const other = await loginByEmailOtp(user.email);
    const list = await client.get("/sessions", { token: accessToken });
    const target = list.body.sessions.find((s) => !s.current);

    const res = await client.delete(`/sessions/${target.id}`, { token: accessToken });
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(true);

    expect((await client.get("/me", { token: accessToken })).status).toBe(200);
    expect((await client.get("/me", { token: other.body.accessToken })).status).toBe(401);
  });

  it("cannot disconnect another person's device", async () => {
    const mine = await signedIn();
    const theirs = await signedIn();
    const theirSession = await prisma().session.findFirst({ where: { userId: theirs.user.id } });

    const res = await mine.client.delete(`/sessions/${theirSession.id}`, {
      token: mine.accessToken,
    });
    expect(res.status).toBe(404);
  });

  it("signs out of every device at once", async () => {
    const { user, accessToken, client } = await signedIn();
    const other = await loginByEmailOtp(user.email);

    const res = await client.post("/logout-all", { token: accessToken });
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(2);
    expect((await client.get("/me", { token: accessToken })).status).toBe(401);
    expect((await client.get("/me", { token: other.body.accessToken })).status).toBe(401);
  });

  it("stops push notifications for a device that logs out", async () => {
    const { user, accessToken, client } = await signedIn();
    await prisma().session.updateMany({
      where: { userId: user.id },
      data: { pushToken: "push-123" },
    });

    const res = await client.post("/logout", { token: accessToken });
    expect(res.status).toBe(204);

    const session = await prisma().session.findFirst({ where: { userId: user.id } });
    expect(session.pushToken).toBeNull();
    expect(session.revokedReason).toBe("LOGOUT");
    expect((await client.get("/me", { token: accessToken })).status).toBe(401);
  });
});

describe("browser cookies", () => {
  async function webLogin() {
    const user = await createUser();
    const login = await loginByEmailOtp(user.email, { device: newDevice("WEB") });
    return { user, login, cookies: cookieHeader(login.response), client: login.client };
  }

  it("authenticates reads with the cookie", async () => {
    const { cookies, client } = await webLogin();
    const res = await client.get("/me", { headers: { Cookie: cookies } });
    expect(res.status).toBe(200);
  });

  it("refuses cookie-authenticated writes from an unknown origin", async () => {
    const { cookies, client } = await webLogin();
    const res = await client.post("/logout", { headers: { Cookie: cookies } });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CORS_NOT_ALLOWED");
  });

  it("accepts writes from an allowed origin", async () => {
    const { cookies, client } = await webLogin();
    const res = await client.post("/logout", { headers: { Cookie: cookies, Origin: ORIGIN } });
    expect(res.status).toBe(204);
  });

  it("refreshes from the cookie only for an allowed origin", async () => {
    const { cookies, client } = await webLogin();
    const blocked = await client.post("/refresh", { body: {}, headers: { Cookie: cookies } });
    expect(blocked.status).toBe(403);

    const ok = await client.post("/refresh", {
      body: {},
      headers: { Cookie: cookies, Origin: ORIGIN },
    });
    expect(ok.status).toBe(200);
    expect(ok.body.accessToken).toBeUndefined();
    expect(ok.headers["set-cookie"].join(";")).toContain("__Host-swg_access=");
  });
});
