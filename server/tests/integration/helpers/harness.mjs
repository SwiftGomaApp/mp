import { createRequire } from "node:module";
import request from "supertest";
import { totpCode } from "../../helpers/totp.mjs";

const require = createRequire(import.meta.url);

const { loadConfig } = require("../../../src/config/env.config");
const { createApp } = require("../../../src/app");
const { connectPrisma, disconnectPrisma, getPrisma } = require("../../../src/core/db/prisma");
const { connectRedis, disconnectRedis, getRedis } = require("../../../src/core/cache/redis");
const { QUEUES, getQueue, closeQueues } = require("../../../src/core/queue/queues");
const { encryptSecret, generateTotpSecret } = require("../../../src/core/auth/totp");
const { signAccessToken } = require("../../../src/core/auth/tokens");

const BASE = "/api/v1";

let app = null;
let ipCounter = 0;
let deviceCounter = 0;

export const prisma = () => getPrisma();
export const redis = () => getRedis();

export async function bootApp() {
  if (app) return;
  const config = await loadConfig();
  await connectPrisma();
  await connectRedis();
  app = createApp(config);
}

export async function shutdownApp() {
  await closeQueues();
  await disconnectRedis();
  await disconnectPrisma();
  app = null;
}

export async function resetState() {
  const tables = await prisma().$queryRaw`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const names = tables.map((row) => `"${row.tablename}"`).join(", ");
  await prisma().$executeRawUnsafe(`TRUNCATE ${names} RESTART IDENTITY CASCADE`);
  await redis().flushdb();
}

function nextIp() {
  ipCounter += 1;
  return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
}

export function newDevice(platform = "ANDROID") {
  deviceCounter += 1;
  return {
    deviceId: `device-${deviceCounter}-abcdef`,
    deviceName: `Phone ${deviceCounter}`,
    platform,
  };
}

function build(prefix, ip) {
  const call = (method, path, { body, token, headers = {} } = {}) => {
    let req = request(app)
      [method](`${BASE}${prefix}${path}`)
      .set("X-Forwarded-For", ip)
      .set("User-Agent", "swg-test-client/1.0");
    if (token) req = req.set("Authorization", `Bearer ${token}`);
    for (const [name, value] of Object.entries(headers)) req = req.set(name, value);
    return body === undefined ? req : req.send(body);
  };

  return {
    ip,
    get: (path, options) => call("get", path, options),
    post: (path, options) => call("post", path, options),
    put: (path, options) => call("put", path, options),
    patch: (path, options) => call("patch", path, options),
    delete: (path, options) => call("delete", path, options),
  };
}

export const authApi = (ip = nextIp()) => build("/auth", ip);
export const adminApi = (ip = nextIp()) => build("/admin", ip);
export const rootApi = (ip = nextIp()) => build("", ip);

export async function outbox() {
  const jobs = await getQueue(QUEUES.NOTIFICATIONS).getJobs([
    "waiting",
    "delayed",
    "active",
    "completed",
    "failed",
  ]);
  return jobs
    .sort((a, b) => a.timestamp - b.timestamp || Number(a.id) - Number(b.id))
    .map((job) => ({ name: job.name, data: job.data }));
}

export async function jobsFor(to, names) {
  const items = await outbox();
  return items.filter(
    (item) => item.data.to === to && (!names || [].concat(names).includes(item.name)),
  );
}

export async function lastCode(to) {
  const items = await jobsFor(to, ["email.otp", "sms.otp"]);
  if (!items.length) throw new Error(`No code was sent to ${to}`);
  return items[items.length - 1].data.code;
}

export async function alertsFor(to) {
  return jobsFor(to, ["email.security-alert", "sms.security-alert"]);
}

export { totpCode };

export async function freshTotp(userId, secret) {
  await prisma().totpCredential.updateMany({ where: { userId }, data: { lastUsedStep: null } });
  return totpCode(secret);
}

export async function clearRateLimits() {
  const raw = redis().duplicate({ keyPrefix: "" });
  const keys = await raw.keys("test:rl:*");
  if (keys.length) await raw.del(...keys);
  raw.disconnect();
}

let userCounter = 0;
export const uniqueEmail = (prefix = "user") => `${prefix}${(userCounter += 1)}@example.com`;
export const uniquePhone = () => `+24389${String((userCounter += 1)).padStart(7, "0")}`;

export async function createUser(overrides = {}) {
  const now = new Date();
  const hasContact = overrides.email || overrides.phone;
  return prisma().user.create({
    data: {
      name: "Test User",
      role: "BUYER",
      status: "ACTIVE",
      ...(hasContact ? {} : { email: uniqueEmail() }),
      ...(overrides.email || !hasContact ? { emailVerifiedAt: now } : {}),
      ...(overrides.phone ? { phoneVerifiedAt: now } : {}),
      termsVersion: "1.0",
      privacyVersion: "1.0",
      termsAcceptedAt: now,
      ageConfirmedAt: now,
      ...overrides,
    },
  });
}

export async function enableTotp(userId) {
  const secret = generateTotpSecret();
  await prisma().totpCredential.create({
    data: { userId, secretEncrypted: encryptSecret(secret), confirmedAt: new Date() },
  });
  return secret;
}

export async function signupByEmail({ email = uniqueEmail(), role = "BUYER", device, api } = {}) {
  const client = api ?? authApi();
  const dev = device ?? newDevice();
  const start = await client.post("/signup/email", {
    body: { name: "New Person", email, role, acceptTerms: true, confirmAge: true },
  });
  if (start.status !== 201)
    throw new Error(`signup failed: ${start.status} ${JSON.stringify(start.body)}`);
  const verify = await client.post("/signup/verify", {
    body: { email, code: await lastCode(email), device: dev },
  });
  return { email, device: dev, client, response: verify, tokens: verify.body };
}

export async function loginByEmailOtp(email, { device = newDevice(), api } = {}) {
  const client = api ?? authApi();
  await clearRateLimits();
  const request = await client.post("/login/otp/request", { body: { email } });
  if (request.status !== 200) {
    throw new Error(`login request failed: ${request.status} ${JSON.stringify(request.body)}`);
  }
  const verify = await client.post("/login/otp/verify", {
    body: { email, code: await lastCode(email), device },
  });
  return { device, client, response: verify, body: verify.body };
}

export async function loginWithTotp(user, secret, { device = newDevice(), api } = {}) {
  const first = await loginByEmailOtp(user.email, { device, api });
  if (first.response.status !== 202) {
    throw new Error(`expected a 2FA challenge, got ${first.response.status}`);
  }
  const verify = await first.client.post("/2fa/verify", {
    body: {
      challengeToken: first.body.challengeToken,
      code: await freshTotp(user.id, secret),
    },
  });
  return { device, client: first.client, response: verify, body: verify.body };
}

export async function createAdminSession() {
  const admin = await createUser({ role: "ADMIN", name: "The Admin", email: uniqueEmail("admin") });
  const secret = await enableTotp(admin.id);
  const login = await loginWithTotp(admin, secret);
  return { admin, secret, token: login.body.accessToken, client: login.client, login };
}

export async function sessionTokenFor(user, device = newDevice()) {
  const session = await prisma().session.create({
    data: {
      userId: user.id,
      refreshTokenHash: `hash-${user.id}-${device.deviceId}-${Math.random()}`,
      deviceId: device.deviceId,
      deviceName: device.deviceName,
      platform: device.platform,
      authMethod: "EMAIL_OTP",
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });
  return signAccessToken({ userId: user.id, role: user.role, sessionId: session.id });
}

export async function stepUpCode(client, token, user) {
  const res = await client.post("/step-up/otp", { token, body: {} });
  if (res.status !== 200) throw new Error(`step-up request failed: ${res.status}`);
  return lastCode(user.email);
}
