const path = require("path");
const { z } = require("zod");

const bool = z.enum(["true", "false"]).transform((v) => v === "true");
const optional = z.string().trim().optional().default("");

const schema = z
  .object({
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
  })
  .superRefine((env, ctx) => {
    const need = (keys) =>
      keys.forEach((k) => {
        if (!env[k]) {
          ctx.addIssue({
            code: "custom",
            path: [k],
            message: `required when MESSAGING_PROVIDER=${env.MESSAGING_PROVIDER}`,
          });
        }
      });

    if (env.MESSAGING_PROVIDER === "twilio") {
      need(["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_PHONE_NUMBER"]);
    }
    if (env.MESSAGING_PROVIDER === "infobip") {
      need(["INFOBIP_BASE_URL", "INFOBIP_API_KEY"]);
    }
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
  });

  return config;
}

function getConfig() {
  if (!config) throw new Error("Config not loaded. Call loadConfig() at startup first.");
  return config;
}

module.exports = { loadConfig, getConfig };
