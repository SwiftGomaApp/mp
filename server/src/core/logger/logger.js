const pino = require("pino");

const isProd = process.env.NODE_ENV === "production";
const level = process.env.LOG_LEVEL || (isProd ? "info" : "debug");

const options = {
  level,
  base: { service: "swiftgoma-api" },
  timestamp: pino.stdTimeFunctions.isoTime,
  redact: {
    paths: [
      "req.headers.authorization",
      "req.headers.cookie",
      'res.headers["set-cookie"]',
      "*.password",
      "*.passwordHash",
      "*.otp",
      "*.code",
      "*.token",
      "*.refreshToken",
      "*.secret",
      "*.backupCode",
      "*.newPassword",
      "*.currentPassword",
      "*.stepUpCode",
      "*.idToken",
      "*.challengeToken",
      "*.recoveryToken",
    ],
    censor: "[Filtered]",
  },
};

const logger = isProd
  ? pino(options)
  : pino(
      options,
      require("pino-pretty")({
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
        ignore: "pid,hostname,service",
        sync: true,
      }),
    );

module.exports = { logger };
