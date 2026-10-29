// Windows runner for the integration suite. The default setup expects Linux paths and a
// redis-server program; this one starts a throwaway PostgreSQL from a local install and uses
// an already running Redis on a spare database number (default 15), which it empties itself.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const PG_BIN = process.env.PG_BIN || "C:/Program Files/PostgreSQL/18/bin";
const REDIS_HOST = process.env.TEST_REDIS_HOST || "127.0.0.1";
const REDIS_PORT = Number(process.env.TEST_REDIS_PORT || 6379);
const REDIS_DB = Number(process.env.TEST_REDIS_DB || 15);
const KEY_PREFIX = "test:";

const freePort = () =>
  new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });

async function withRedis(action) {
  const Redis = require("ioredis");
  const client = new Redis({
    host: REDIS_HOST,
    port: REDIS_PORT,
    db: REDIS_DB,
    lazyConnect: true,
    retryStrategy: () => null,
  });
  await client.connect();
  try {
    return await action(client);
  } finally {
    await client.quit();
  }
}

async function clearTestKeys() {
  await withRedis(async (redis) => {
    const keys = await redis.keys("*");
    if (keys.every((key) => key.startsWith(KEY_PREFIX))) await redis.flushdb();
  });
}

export default async function setup() {
  const leftover = await withRedis(async (redis) =>
    (await redis.keys("*")).filter((key) => !key.startsWith(KEY_PREFIX)),
  );
  if (leftover.length) {
    throw new Error(
      `Redis db ${REDIS_DB} holds data that is not from this test run (${leftover.length} keys). ` +
        "Set TEST_REDIS_DB to an empty database number.",
    );
  }
  await clearTestKeys();

  const dir = mkdtempSync(join(tmpdir(), "swg-integration-"));
  const port = await freePort();
  const dataDir = join(dir, "pg");
  const pg = (name) => join(PG_BIN, `${name}.exe`);

  execFileSync(pg("initdb"), ["-D", dataDir, "-U", "test", "--auth=trust", "-E", "UTF8", "--locale=C"], {
    stdio: "ignore",
  });
  execFileSync(
    pg("pg_ctl"),
    [
      "-D",
      dataDir,
      "-o",
      `-p ${port} -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off`,
      "-l",
      join(dir, "pg.log"),
      "-w",
      "start",
    ],
    { stdio: "ignore" },
  );
  execFileSync(pg("createdb"), ["-h", "127.0.0.1", "-p", String(port), "-U", "test", "swg_test"], {
    stdio: "ignore",
  });

  Object.assign(process.env, {
    NODE_ENV: "test",
    SECRETS_PROVIDER: "env",
    LOG_LEVEL: "silent",
    PORT: "4999",
    API_BASE_URL: "http://localhost:4999",
    CORS_ORIGINS: "http://localhost:3000",
    TRUST_PROXY: "1",
    DATABASE_URL: `postgresql://test@127.0.0.1:${port}/swg_test`,
    REDIS_URL: `redis://${REDIS_HOST}:${REDIS_PORT}/${REDIS_DB}`,
    REDIS_KEY_PREFIX: KEY_PREFIX,
    SMTP_HOST: "localhost",
    SMTP_USER: "test",
    SMTP_PASS: "test",
    MAIL_FROM: "SwiftGoma <no-reply@example.com>",
    MAIL_LOGO_URL: "https://example.com/logo.png",
    MAIL_PRIVACY_URL: "https://example.com/privacy",
    AT_USERNAME: "sandbox",
    AT_API_KEY: "test",
    SMS_DRY_RUN: "true",
    SMS_DAILY_OTP_LIMIT: "0",
    SMS_DAILY_ALERT_LIMIT: "0",
    PUSH_DRY_RUN: "true",
    AT_WEBHOOK_SECRET: "webhook-test-secret",
    MARKETING_LINK_SECRET: "m".repeat(40),
    JWT_ACCESS_SECRET: "a".repeat(48),
    OTP_SECRET: "b".repeat(48),
    OTP_RESEND_SECONDS: "0",
    OTP_MAX_PER_HOUR: "50",
    TOTP_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString("base64"),
    GOOGLE_CLIENT_IDS: "test-google-client",
    APPLE_CLIENT_IDS: "test.apple.client",
    PASSKEY_RP_ID: "localhost",
    PASSKEY_ORIGINS: "http://localhost:3000",
  });

  const prismaCli = require.resolve("prisma/build/index.js");
  for (const args of [["generate"], ["migrate", "deploy"]]) {
    execFileSync(process.execPath, [prismaCli, ...args], { env: { ...process.env }, stdio: "ignore" });
  }

  return async function teardown() {
    try {
      execFileSync(pg("pg_ctl"), ["-D", dataDir, "-m", "immediate", "stop"], { stdio: "ignore" });
    } catch {
      // already stopped
    }
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      // Windows may still hold a file for a moment; the folder is in the temp directory
    }
    await clearTestKeys().catch(() => {});
  };
}
