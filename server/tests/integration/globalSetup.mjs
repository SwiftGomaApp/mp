import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function freePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

function findPostgresBin() {
  if (process.env.PG_BIN) return process.env.PG_BIN;
  const root = "/usr/lib/postgresql";
  if (!existsSync(root)) throw new Error("PostgreSQL not found: set PG_BIN to its bin directory");
  const versions = readdirSync(root).sort((a, b) => Number(b) - Number(a));
  for (const version of versions) {
    const bin = join(root, version, "bin");
    if (existsSync(join(bin, "initdb"))) return bin;
  }
  throw new Error("PostgreSQL server binaries not found: set PG_BIN to its bin directory");
}

async function waitForRedis(port) {
  const Redis = require("ioredis");
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const client = new Redis({
      port,
      host: "127.0.0.1",
      lazyConnect: true,
      retryStrategy: () => null,
    });
    try {
      await client.connect();
      await client.ping();
      await client.quit();
      return;
    } catch {
      client.disconnect();
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error("Redis did not start");
}

export default async function setup() {
  const dir = mkdtempSync(join(tmpdir(), "swg-integration-"));
  const pgBin = findPostgresBin();
  const pgPort = await freePort();
  const redisPort = await freePort();
  const dataDir = join(dir, "pg");

  execFileSync(join(pgBin, "initdb"), ["-D", dataDir, "-U", "test", "--auth=trust", "-E", "UTF8"], {
    stdio: "ignore",
  });
  execFileSync(
    join(pgBin, "pg_ctl"),
    [
      "-D",
      dataDir,
      "-o",
      `-p ${pgPort} -k ${dir} -c listen_addresses=127.0.0.1 -c fsync=off -c synchronous_commit=off`,
      "-l",
      join(dir, "pg.log"),
      "-w",
      "start",
    ],
    { stdio: "ignore" },
  );
  execFileSync(
    join(pgBin, "createdb"),
    ["-h", "127.0.0.1", "-p", String(pgPort), "-U", "test", "swg_test"],
    { stdio: "ignore" },
  );

  const redis = spawn(
    "redis-server",
    [
      "--port",
      String(redisPort),
      "--bind",
      "127.0.0.1",
      "--save",
      "",
      "--appendonly",
      "no",
      "--dir",
      dir,
    ],
    { stdio: "ignore" },
  );
  await waitForRedis(redisPort);

  const databaseUrl = `postgresql://test@127.0.0.1:${pgPort}/swg_test`;
  Object.assign(process.env, {
    NODE_ENV: "test",
    SECRETS_PROVIDER: "env",
    LOG_LEVEL: "silent",
    PORT: "4999",
    API_BASE_URL: "http://localhost:4999",
    CORS_ORIGINS: "http://localhost:3000",
    TRUST_PROXY: "1",
    DATABASE_URL: databaseUrl,
    REDIS_URL: `redis://127.0.0.1:${redisPort}`,
    REDIS_KEY_PREFIX: "test:",
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
    execFileSync(process.execPath, [prismaCli, ...args], {
      env: { ...process.env },
      stdio: "ignore",
    });
  }

  return async function teardown() {
    redis.kill("SIGTERM");
    try {
      execFileSync(join(pgBin, "pg_ctl"), ["-D", dataDir, "-m", "immediate", "stop"], {
        stdio: "ignore",
      });
    } catch {
      // already stopped
    }
    rmSync(dir, { recursive: true, force: true });
  };
}
