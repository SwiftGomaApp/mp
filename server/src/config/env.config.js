const path = require("path");
const { z } = require("zod");

const optional = z.string().trim().optional().default("");

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

  SENTRY_DSN: optional,
  SENTRY_ENVIRONMENT: optional,
  SENTRY_RELEASE: optional,
  SENTRY_TRACES_SAMPLE_RATE: z.coerce.number().min(0).max(1).default(0.1),

  DATABASE_URL: z.string().min(1),
  DB_POOL_MAX: z.coerce.number().int().min(1).max(100).default(10),
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
    sentry: {
      dsn: env.SENTRY_DSN,
      environment: env.SENTRY_ENVIRONMENT || env.NODE_ENV,
      release: env.SENTRY_RELEASE,
      tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    },
    databaseUrl: env.DATABASE_URL,
    dbPoolMax: env.DB_POOL_MAX,
  });

  return config;
}

function getConfig() {
  if (!config) throw new Error("Config not loaded. Call loadConfig() at startup first.");
  return config;
}

module.exports = { loadConfig, getConfig };
