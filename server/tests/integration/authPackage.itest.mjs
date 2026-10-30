// Contract tests: the swiftgoma-mp-auth package against the real API, in memory.
// Every request the package makes goes through the same Express app the other integration
// tests use, so a change in the server that the package does not expect fails here.
import { createRequire } from "node:module";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AxiosError, AxiosHeaders } from "../../../packages/auth/node_modules/axios/index.js";
import {
  ValidationError,
  createAuth,
  createMemoryStorage,
} from "../../../packages/auth/src/index.ts";
import {
  authApi,
  bootApp,
  clearRateLimits,
  createUser,
  enableTotp,
  freshTotp,
  lastCode,
  prisma,
  resetState,
  rootApi,
  shutdownApp,
  uniqueEmail,
} from "./helpers/harness.mjs";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");
const { getConfig } = require("../../src/config/env.config");

beforeAll(bootApp);
afterAll(shutdownApp);
beforeEach(resetState);

const ORIGIN = "http://localhost:3000";
const REFRESH_KEY = "swiftgoma-mp-auth.refreshToken";
const ACCESS_KEY = "swiftgoma-mp-auth.accessToken";

// A browser: keeps the cookies the server sets and sends them back.
function createJar() {
  const cookies = new Map();
  return {
    absorb(response) {
      for (const line of response.headers["set-cookie"] ?? []) {
        const [pair] = line.split(";");
        const index = pair.indexOf("=");
        const name = pair.slice(0, index);
        const value = pair.slice(index + 1);
        if (value) cookies.set(name, value);
        else cookies.delete(name);
      }
    },
    header: () => [...cookies].map(([name, value]) => `${name}=${value}`).join("; "),
    has: (name) => cookies.has(name),
  };
}

// Lets the package talk to the in-memory app as if it were an HTTP server.
function serverTransport(jar) {
  const api = rootApi();
  return async (config) => {
    const headers = {};
    for (const [name, value] of Object.entries(config.headers.toJSON())) {
      if (value != null && name.toLowerCase() !== "content-length") headers[name] = String(value);
    }
    if (jar) {
      headers.Origin = ORIGIN;
      if (jar.header()) headers.Cookie = jar.header();
    }
    const query = config.params ? `?${new URLSearchParams(config.params)}` : "";
    const body = typeof config.data === "string" ? JSON.parse(config.data) : config.data;

    const res = await api[config.method](`${config.url}${query}`, { body, headers });
    jar?.absorb(res);

    const response = {
      status: res.status,
      statusText: "",
      data: res.status === 204 ? "" : res.body,
      headers: new AxiosHeaders(res.headers),
      config,
    };
    if (res.status < 300) return response;
    throw new AxiosError("failed", "ERR_BAD_RESPONSE", config, undefined, response);
  };
}

let deviceCounter = 0;

function newClient({ platform = "ANDROID", storage = createMemoryStorage(), deviceId } = {}) {
  const jar = platform === "WEB" ? createJar() : null;
  const id = deviceId ?? `contract-device-${(deviceCounter += 1)}`;
  const auth = createAuth({
    baseUrl: "http://test.local",
    adapter: { platform, storage, getDeviceName: () => "Contract test", randomId: () => id },
    transport: serverTransport(jar),
  });
  return { auth, storage, jar, deviceId: id };
}

async function signInByEmailCode(auth, email) {
  await clearRateLimits();
  await auth.login.emailCode.request({ email });
  return auth.login.emailCode.verify({ email, code: await lastCode(email) });
}

describe("a phone, from sign-up to logout", () => {
  it("signs up, reads the account, rotates tokens, lists devices and signs out", async () => {
    const { auth, storage } = newClient();
    const email = uniqueEmail();

    const sent = await auth.signup.email({
      name: "New Person",
      email,
      role: "BUYER",
      acceptTerms: true,
      confirmAge: true,
    });
    expect(sent).toMatchObject({ method: "EMAIL", target: email });

    const { user } = await auth.signup.verify({ email, code: await lastCode(email) });
    expect(user).toMatchObject({ email, role: "BUYER", status: "ACTIVE" });
    expect(auth.session.getState().status).toBe("authenticated");

    // The server says how long the token lasts, so the first early refresh can be planned.
    const lifetime = auth.session.getState().accessExpiresAt - Date.now();
    expect(lifetime).toBeGreaterThan(890_000);
    expect(lifetime).toBeLessThanOrEqual(900_000);

    const me = await auth.me();
    expect(me).toMatchObject({ email, emailVerified: true, twoFactorEnabled: false });

    const before = await storage.getItem(REFRESH_KEY);
    await auth.session.refreshNow();
    expect(await storage.getItem(REFRESH_KEY)).not.toBe(before);
    expect((await auth.me()).email).toBe(email);

    const devices = await auth.devices.list();
    expect(devices).toHaveLength(1);
    expect(devices[0]).toMatchObject({
      current: true,
      platform: "ANDROID",
      deviceName: "Contract test",
    });

    await auth.logout();
    expect(auth.session.getState().status).toBe("anonymous");
    expect(await storage.getItem(REFRESH_KEY)).toBeNull();
  });

  it("signs in with an e-mail code and knows when the device is new", async () => {
    const user = await createUser();
    const first = newClient({ deviceId: "contract-same-device" });
    expect(await signInByEmailCode(first.auth, user.email)).toMatchObject({
      status: "authenticated",
      isNewDevice: true,
    });

    const again = newClient({ deviceId: "contract-same-device" });
    expect(await signInByEmailCode(again.auth, user.email)).toMatchObject({
      status: "authenticated",
      isNewDevice: false,
    });
  });

  it("reports a wrong code and a refused sign-up as typed errors", async () => {
    const user = await createUser();
    const { auth } = newClient();
    await clearRateLimits();
    await auth.login.emailCode.request({ email: user.email });
    await expect(
      auth.login.emailCode.verify({ email: user.email, code: "000000" }),
    ).rejects.toMatchObject({ code: "OTP_INVALID", status: 400 });

    const refused = await auth.signup
      .email({
        name: "X",
        email: "not-an-email",
        role: "BUYER",
        acceptTerms: true,
        confirmAge: true,
      })
      .catch((error) => error);
    expect(refused).toBeInstanceOf(ValidationError);
    expect(refused.fields.length).toBeGreaterThan(0);
  });
});

describe("a browser with cookies", () => {
  it("signs up, refreshes through the cookie and signs out", async () => {
    const { auth, jar } = newClient({ platform: "WEB" });
    const email = uniqueEmail();

    await auth.signup.email({
      name: "Web Person",
      email,
      role: "BUYER",
      acceptTerms: true,
      confirmAge: true,
    });
    await auth.signup.verify({ email, code: await lastCode(email) });

    expect(jar.has("__Host-swg_access")).toBe(true);
    expect(jar.has("swg_refresh")).toBe(true);
    expect(await auth.session.getAccessToken()).toBeNull();
    expect(auth.session.getState().accessExpiresAt - Date.now()).toBeGreaterThan(890_000);

    expect((await auth.me()).email).toBe(email);

    const refreshCookie = jar.header();
    await auth.session.refreshNow();
    expect(jar.header()).not.toBe(refreshCookie);
    expect((await auth.me()).email).toBe(email);

    await auth.logout();
    expect(jar.has("__Host-swg_access")).toBe(false);
    await expect(auth.me()).rejects.toMatchObject({ status: 401 });
  });

  it("restores the session when only the refresh cookie is left", async () => {
    const { auth, jar } = newClient({ platform: "WEB" });
    const user = await createUser();
    await signInByEmailCode(auth, user.email);

    // The access cookie lives 15 minutes; the browser drops it when it expires.
    jar.absorb({
      headers: {
        "set-cookie": ["__Host-swg_access=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT"],
      },
    });

    const restarted = newClient({ platform: "WEB" });
    restarted.jar.absorb({
      headers: { "set-cookie": [`swg_refresh=${jar.header().match(/swg_refresh=([^;]+)/)[1]}`] },
    });
    await restarted.auth.start();
    expect((await restarted.auth.me()).email).toBe(user.email);
    expect(restarted.jar.has("__Host-swg_access")).toBe(true);
    restarted.auth.stop();
  });
});

describe("two-step verification", () => {
  it("asks for the second step and finishes with an app code", async () => {
    const user = await createUser();
    const secret = await enableTotp(user.id);
    const { auth } = newClient();

    const first = await signInByEmailCode(auth, user.email);
    expect(first.status).toBe("twoFactorRequired");
    expect(auth.session.getState().status).toBe("unknown");

    const done = await auth.twoFactor.verify({ code: await freshTotp(user.id, secret) });
    expect(done.user.id).toBe(user.id);
    expect(auth.session.getState().status).toBe("authenticated");
  });
});

describe("keeping the session alive", () => {
  it("recovers from an expired access token without the app noticing", async () => {
    const user = await createUser();
    const { auth, storage, deviceId } = newClient();
    await signInByEmailCode(auth, user.email);
    auth.stop();

    // Replace the access token by one the server will say has expired.
    const session = await prisma().session.findFirst({ where: { userId: user.id, deviceId } });
    const { accessSecret } = getConfig().auth;
    const expired = jwt.sign({ role: user.role, sid: session.id }, accessSecret, {
      algorithm: "HS256",
      subject: user.id,
      issuer: "swiftgoma-api",
      audience: "swiftgoma-app",
      expiresIn: -60,
    });
    await storage.setItem(
      ACCESS_KEY,
      JSON.stringify({ token: expired, expiresAt: Date.now() + 600_000 }),
    );

    const restarted = createAuth({
      baseUrl: "http://test.local",
      adapter: { platform: "ANDROID", storage, randomId: () => deviceId },
      transport: serverTransport(null),
    });
    await restarted.start();
    const before = await storage.getItem(REFRESH_KEY);

    expect((await restarted.me()).id).toBe(user.id);
    expect(await storage.getItem(REFRESH_KEY)).not.toBe(before);
    restarted.stop();
  });

  it("treats a stolen, replayed refresh token as theft and ends the session", async () => {
    const user = await createUser();
    const { auth, storage } = newClient();
    await signInByEmailCode(auth, user.email);

    const stolen = await storage.getItem(REFRESH_KEY);
    await auth.session.refreshNow();

    const replay = await authApi().post("/refresh", {
      body: { refreshToken: stolen },
      headers: { "User-Agent": "some-other-client/9.9" },
    });
    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("TOKEN_REUSED");

    const ended = [];
    auth.session.onSessionEnded((reason) => ended.push(reason));
    await expect(auth.session.refreshNow()).rejects.toMatchObject({ status: 401 });
    expect(auth.session.getState().status).toBe("anonymous");
    expect(ended).toHaveLength(1);
  });

  it("ends the session of the oldest device when a sixth one signs in", async () => {
    const user = await createUser();
    const clients = [];
    for (let i = 0; i < 6; i += 1) {
      const client = newClient();
      await signInByEmailCode(client.auth, user.email);
      clients.push(client);
    }

    await expect(clients[0].auth.session.refreshNow()).rejects.toMatchObject({ status: 401 });
    expect(clients[0].auth.session.getState().status).toBe("anonymous");
    await clients[5].auth.session.refreshNow();
    expect((await clients[5].auth.devices.list()).length).toBe(5);
  });

  it("ends every other device on logoutAll", async () => {
    const user = await createUser();
    const phone = newClient();
    const tablet = newClient();
    await signInByEmailCode(phone.auth, user.email);
    await signInByEmailCode(tablet.auth, user.email);

    expect((await phone.auth.logoutAll()).revoked).toBe(2);
    await expect(tablet.auth.session.refreshNow()).rejects.toMatchObject({ status: 401 });
    expect(tablet.auth.session.getState().status).toBe("anonymous");
  });

  it("ends the session of a suspended account", async () => {
    const user = await createUser();
    const { auth } = newClient();
    await signInByEmailCode(auth, user.email);

    await prisma().user.update({ where: { id: user.id }, data: { status: "SUSPENDED" } });
    await expect(auth.session.refreshNow()).rejects.toMatchObject({ code: "ACCOUNT_SUSPENDED" });
    expect(auth.session.getState().status).toBe("anonymous");
  });

  it("lets a device sign out another one", async () => {
    const user = await createUser();
    const phone = newClient();
    const tablet = newClient();
    await signInByEmailCode(phone.auth, user.email);
    await signInByEmailCode(tablet.auth, user.email);

    const devices = await phone.auth.devices.list();
    const other = devices.find((device) => !device.current);
    expect(await phone.auth.devices.disconnect(other.id)).toEqual({ current: false });
    await expect(tablet.auth.session.refreshNow()).rejects.toMatchObject({ status: 401 });
  });
});
