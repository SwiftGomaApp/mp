import { describe, expect, it } from "vitest";
import { createAuth, createMemoryStorage } from "../src/index";
import { createFakeAuthServer, createTestAdapter } from "../src/testing/index";
import type { Platform } from "../src/index";

function setup(platform: Platform = "ANDROID") {
  const server = createFakeAuthServer();
  const storage = createMemoryStorage();
  const make = () =>
    createAuth({
      baseUrl: "https://api.example.com",
      adapter: createTestAdapter(platform, storage),
      transport: server.transport,
    });
  return { server, storage, make, auth: make() };
}

describe("the fake server: sign-up and sign-in", () => {
  it("signs a new user up with the fixed code", async () => {
    const { auth, server } = setup();
    await auth.signup.email({
      name: "Gael",
      email: "gael@example.com",
      role: "BUYER",
      acceptTerms: true,
      confirmAge: true,
    });
    const { user } = await auth.signup.verify({ email: "gael@example.com", code: server.code });

    expect(user).toMatchObject({ name: "Gael", email: "gael@example.com", role: "BUYER" });
    expect(auth.session.getState().status).toBe("authenticated");
    expect((await auth.me()).email).toBe("gael@example.com");
  });

  it("refuses a wrong code and an existing account", async () => {
    const { auth, server } = setup();
    server.addUser({ email: "gael@example.com" });
    await expect(
      auth.signup.email({
        name: "Gael",
        email: "gael@example.com",
        role: "BUYER",
        acceptTerms: true,
        confirmAge: true,
      }),
    ).rejects.toMatchObject({ code: "ACCOUNT_EXISTS", status: 409 });

    await auth.login.emailCode.request({ email: "gael@example.com" });
    await expect(
      auth.login.emailCode.verify({ email: "gael@example.com", code: "000000" }),
    ).rejects.toMatchObject({ code: "OTP_INVALID" });
  });

  it("signs in with a code, a phone code and a password", async () => {
    const { auth, server } = setup();
    server.addUser({ email: "gael@example.com", phone: "+243990000000", password: "secret123" });

    expect(
      await auth.login.emailCode.verify({ email: "gael@example.com", code: server.code }),
    ).toMatchObject({ status: "authenticated", isNewDevice: true });
    await auth.logout();

    await auth.login.phoneCode.request({ phone: "+243990000000" });
    expect(
      (await auth.login.phoneCode.verify({ phone: "+243990000000", code: server.code })).status,
    ).toBe("authenticated");
    await auth.logout();

    expect(
      (await auth.login.password({ email: "gael@example.com", password: "secret123" })).status,
    ).toBe("authenticated");
    await expect(
      auth.login.password({ email: "gael@example.com", password: "wrong" }),
    ).rejects.toMatchObject({ code: "INVALID_CREDENTIALS" });
  });

  it("asks for the second step when the user has two-step verification", async () => {
    const { auth, server } = setup();
    server.addUser({ email: "gael@example.com", password: "secret123", twoFactor: true });

    const first = await auth.login.password({ email: "gael@example.com", password: "secret123" });
    expect(first.status).toBe("twoFactorRequired");
    await expect(auth.twoFactor.verify({ code: "000000" })).rejects.toMatchObject({
      code: "TWO_FACTOR_INVALID",
    });
    const done = await auth.twoFactor.verify({ code: server.code });
    expect(done.user.email).toBe("gael@example.com");
  });

  it("works for a browser with cookies", async () => {
    const { auth, server } = setup("WEB");
    server.addUser({ email: "gael@example.com", password: "secret123" });
    await auth.login.password({ email: "gael@example.com", password: "secret123" });

    expect(await auth.session.getAccessToken()).toBeNull();
    expect((await auth.me()).email).toBe("gael@example.com");
    await auth.logout();
    await expect(auth.me()).rejects.toMatchObject({ status: 401 });
  });
});

describe("the fake server: keeping the session alive", () => {
  it("renews an expired access token on its own", async () => {
    const { auth, server } = setup();
    server.addUser({ email: "gael@example.com", password: "secret123" });
    await auth.login.password({ email: "gael@example.com", password: "secret123" });

    server.expireAccessTokens();
    expect((await auth.me()).email).toBe("gael@example.com");
    expect(server.requests.filter((r) => r.path === "/auth/refresh")).toHaveLength(1);
  });

  it("renews a browser session the same way", async () => {
    const { auth, server } = setup("WEB");
    server.addUser({ email: "gael@example.com", password: "secret123" });
    await auth.login.password({ email: "gael@example.com", password: "secret123" });

    server.expireAccessTokens();
    expect((await auth.me()).email).toBe("gael@example.com");
  });

  it("restores the session after the app restarts", async () => {
    const { auth, server, make } = setup();
    server.addUser({ email: "gael@example.com", password: "secret123" });
    await auth.login.password({ email: "gael@example.com", password: "secret123" });
    auth.stop();

    const restarted = make();
    await restarted.start();
    expect((await restarted.me()).email).toBe("gael@example.com");
    restarted.stop();
  });

  it("ends the session when the server revoked it", async () => {
    const { auth, server } = setup();
    server.addUser({ email: "gael@example.com", password: "secret123" });
    await auth.login.password({ email: "gael@example.com", password: "secret123" });
    const ended: string[] = [];
    auth.session.onSessionEnded((reason) => ended.push(reason));

    server.revokeSessions();
    await expect(auth.session.refreshNow()).rejects.toMatchObject({ status: 401 });
    expect(auth.session.getState().status).toBe("anonymous");
    expect(ended).toHaveLength(1);
  });

  it("treats a replayed refresh token as theft", async () => {
    const { auth, server, storage } = setup();
    server.addUser({ email: "gael@example.com", password: "secret123" });
    await auth.login.password({ email: "gael@example.com", password: "secret123" });

    const stolen = await storage.getItem("swiftgoma-mp-auth.refreshToken");
    await auth.session.refreshNow();
    await expect(auth.api.post("/auth/refresh", { refreshToken: stolen })).rejects.toMatchObject({
      code: "TOKEN_REUSED",
    });
    await expect(auth.session.refreshNow()).rejects.toMatchObject({ status: 401 });
    expect(auth.session.getState().status).toBe("anonymous");
  });

  it("keeps the session through a loss of connection", async () => {
    const { auth, server } = setup();
    server.addUser({ email: "gael@example.com", password: "secret123" });
    await auth.login.password({ email: "gael@example.com", password: "secret123" });

    server.setOffline(true);
    await expect(auth.session.refreshNow()).rejects.toMatchObject({ code: "NETWORK_ERROR" });
    expect(auth.session.getState().status).toBe("authenticated");

    server.setOffline(false);
    await auth.session.refreshNow();
    expect((await auth.me()).email).toBe("gael@example.com");
  });
});

describe("the fake server: devices", () => {
  it("lists devices, signs another out and signs out everywhere", async () => {
    const { server, make } = setup();
    server.addUser({ email: "gael@example.com", password: "secret123" });

    const phone = make();
    await phone.login.password({ email: "gael@example.com", password: "secret123" });

    // A second device: another storage, so another sign-in.
    const second = createAuth({
      baseUrl: "https://api.example.com",
      adapter: { ...createTestAdapter(), randomId: () => "test-device-0002" },
      transport: server.transport,
    });
    await second.login.password({ email: "gael@example.com", password: "secret123" });

    const devices = await phone.devices.list();
    expect(devices).toHaveLength(2);
    const other = devices.find((d) => !d.current)!;
    expect(await phone.devices.disconnect(other.id)).toEqual({ current: false });
    expect(await phone.devices.list()).toHaveLength(1);

    expect(await phone.logoutAll()).toEqual({ revoked: 1 });
    expect(phone.session.getState().status).toBe("anonymous");
  });
});
