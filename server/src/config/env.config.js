const path = require("path");
const { z } = require("zod");

const optional = z.string().trim().optional().default("");

function parseTrustProxy(value) {
  const v = String(value ?? "")
    .trim()
    .toLowerCase();
  if (v === "" || v === "false" || v === "0") return false;
  if (/^[0-9]+$/.test(v)) return Number(v);
  return null;
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  API_BASE_URL: z.string().url(),
  CORS_ORIGINS: z
    .string()
    .min(1)
    .transform((v) =>
      v
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ),

  TRUST_PROXY: z
    .string()
    .default("false")
    .transform((value, ctx) => {
      const parsed = parseTrustProxy(value);
      if (parsed === null) {
        ctx.addIssue({
          code: "custom",
          message: "Use false or the number of trusted proxies (for example 1)",
        });
        return z.NEVER;
      }
      return parsed;
    }),

  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"]).default("info"),

  SENTRY_DSN: optional,
  SENTRY_ENVIRONMENT: optional,
  SENTRY_RELEASE: optional,
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),

  REDIS_URL: z.string().min(1),
  REDIS_KEY_PREFIX: z.string().default("swg:"),
  WORKER_CONCURRENCY: z.coerce.number().int().min(1).max(50).default(5),

  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().positive().default(465),
  SMTP_SECURE: z
    .enum(["true", "false"])
    .default("true")
    .transform((v) => v === "true"),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  MAIL_FROM: z.string().min(1),
  MAIL_LOGO_URL: z.string().url(),
  MAIL_SUPPORT_EMAIL: z.string().email().default("support@swiftgoma.com"),
  MAIL_PRIVACY_URL: z.string().url(),
  MAIL_ACTIVITY_URL: z.string().url().default("https://swiftgoma.com/compte/activite"),
  MAIL_LOGO_WIDTH: z.coerce.number().int().positive().default(140),
  MAIL_LOGO_HEIGHT: z.coerce.number().int().positive().default(40),

  AT_USERNAME: z.string().min(1),
  AT_API_KEY: z.string().min(1),
  AT_SENDER_ID: optional,
  SMS_DRY_RUN: z
    .enum(["true", "false"])
    .default("false")
    .transform((v) => v === "true"),
  SMS_TIMEOUT_MS: z.coerce.number().int().min(1000).default(10000),
  SMS_DAILY_OTP_LIMIT: z.coerce.number().int().min(0).default(2000),

  JWT_ACCESS_SECRET: z.string().min(32),
  ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().min(60).default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).default(7),

  OTP_SECRET: z.string().min(32),
  OTP_TTL_MINUTES: z.coerce.number().int().min(1).max(30).default(10),
  OTP_RESEND_SECONDS: z.coerce.number().int().min(0).default(60),
  OTP_MAX_ATTEMPTS: z.coerce.number().int().min(1).max(10).default(5),

  TOTP_ENCRYPTION_KEY: z
    .string()
    .refine((v) => Buffer.from(v, "base64").length === 32, "Must be 32 bytes encoded in base64"),
  TOTP_ISSUER: z.string().min(1).default("SwiftGoma"),
  PASSKEY_RP_ID: z.string().min(1).default("localhost"),
  PASSKEY_RP_NAME: z.string().min(1).default("SwiftGoma"),
  PASSKEY_ORIGINS: z
    .string()
    .min(1)
    .default("http://localhost:3000")
    .transform((v) =>
      v
        .split(",")
        .map((o) => o.trim())
        .filter(Boolean),
    ),
  IPINFO_TOKEN: optional,
  GOOGLE_CLIENT_IDS: z.string().trim().default(""),
  APPLE_CLIENT_IDS: z.string().trim().default(""),
});

let config = null;

function loadFromDotenv() {
  require("dotenv").config({ path: path.resolve(__dirname, "../../.env") });
}

async function loadFromInfisical() {
  const { InfisicalSDK } = require("@infisical/sdk");
  const { INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID, INFISICAL_ENV } =
    process.env;

  if (!INFISICAL_CLIENT_ID || !INFISICAL_CLIENT_SECRET || !INFISICAL_PROJECT_ID || !INFISICAL_ENV) {
    throw new Error(
      "Infisical bootstrap variables missing: INFISICAL_CLIENT_ID, INFISICAL_CLIENT_SECRET, INFISICAL_PROJECT_ID, INFISICAL_ENV",
    );
  }

  const client = new InfisicalSDK({
    siteUrl: process.env.INFISICAL_SITE_URL || "https://app.infisical.com",
  });

  await client.auth().universalAuth.login({
    clientId: INFISICAL_CLIENT_ID,
    clientSecret: INFISICAL_CLIENT_SECRET,
  });

  const { secrets } = await client.secrets().listSecrets({
    projectId: INFISICAL_PROJECT_ID,
    environment: INFISICAL_ENV,
    secretPath: process.env.INFISICAL_SECRET_PATH || "/",
    expandSecretReferences: true,
  });

  for (const { secretKey, secretValue } of secrets) {
    process.env[secretKey] = secretValue;
  }
}

async function loadConfig() {
  if (config) return config;

  const nodeEnv = process.env.NODE_ENV || "development";
  const provider =
    process.env.SECRETS_PROVIDER || (nodeEnv === "production" ? "infisical" : "dotenv");

  if (provider === "infisical") {
    await loadFromInfisical();
  } else {
    loadFromDotenv();
  }

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((i) => `  - ${i.path.join(".")}: ${i.message}`);
    throw new Error(`Invalid environment configuration (${provider}):\n${lines.join("\n")}`);
  }

  const env = parsed.data;

  config = Object.freeze({
    env: env.NODE_ENV,
    isProd: env.NODE_ENV === "production",
    port: env.PORT,
    apiBaseUrl: env.API_BASE_URL,
    corsOrigins: env.CORS_ORIGINS,
    trustProxy: env.TRUST_PROXY,
    sentry: {
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
      release: env.SENTRY_RELEASE,
      tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    },
    databaseUrl: env.DATABASE_URL,
    dbPoolMax: env.DB_POOL_MAX,
    redis: {
      url: env.REDIS_URL,
      keyPrefix: env.REDIS_KEY_PREFIX,
    },
    workerConcurrency: env.WORKER_CONCURRENCY,
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
      from: env.MAIL_FROM,
    },
    mail: {
      logoUrl: env.MAIL_LOGO_URL,
      supportEmail: env.MAIL_SUPPORT_EMAIL,
      privacyUrl: env.MAIL_PRIVACY_URL,
      activityUrl: env.MAIL_ACTIVITY_URL,
      logoWidth: env.MAIL_LOGO_WIDTH,
      logoHeight: env.MAIL_LOGO_HEIGHT,
    },
    sms: {
      username: env.AT_USERNAME,
      apiKey: env.AT_API_KEY,
      senderId: env.AT_SENDER_ID,
      dryRun: env.SMS_DRY_RUN,
      timeoutMs: env.SMS_TIMEOUT_MS,
      dailyOtpLimit: env.SMS_DAILY_OTP_LIMIT,
    },
    geo: {
      ipinfoToken: env.IPINFO_TOKEN,
    },
    passkey: {
      rpId: env.PASSKEY_RP_ID,
      rpName: env.PASSKEY_RP_NAME,
      origins: env.PASSKEY_ORIGINS,
    },
    auth: {
      accessSecret: env.JWT_ACCESS_SECRET,
      accessTtlSeconds: env.ACCESS_TOKEN_TTL_SECONDS,
      refreshTtlDays: env.REFRESH_TOKEN_TTL_DAYS,
      otpSecret: env.OTP_SECRET,
      otpTtlMinutes: env.OTP_TTL_MINUTES,
      otpResendSeconds: env.OTP_RESEND_SECONDS,
      otpMaxAttempts: env.OTP_MAX_ATTEMPTS,
      totpKey: Buffer.from(env.TOTP_ENCRYPTION_KEY, "base64"),
      totpIssuer: env.TOTP_ISSUER,
    },
    google: {
      clientIds: env.GOOGLE_CLIENT_IDS.split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    },
    apple: {
      clientIds: env.APPLE_CLIENT_IDS.split(",")
        .map((id) => id.trim())
        .filter(Boolean),
    },
  });

  return config;
}

function getConfig() {
  if (!config) throw new Error("Config not loaded. Call loadConfig() at startup first.");
  return config;
}

module.exports = { loadConfig, getConfig, parseTrustProxy };
