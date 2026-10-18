const path = require("path");

if ((process.env.NODE_ENV || "development") !== "production") {
  require("dotenv").config({ path: path.resolve(__dirname, ".env") });
}

const Sentry = require("@sentry/node");

const SENSITIVE_KEYS = ["password", "otp", "code", "token", "refreshToken", "pin", "secret"];

function scrub(obj) {
  if (!obj || typeof obj !== "object") return obj;
  for (const key of Object.keys(obj)) {
    if (SENSITIVE_KEYS.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
      obj[key] = "[Filtered]";
    } else if (typeof obj[key] === "object") {
      scrub(obj[key]);
    }
  }
  return obj;
}

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || undefined,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.request) {
        if (event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
        }
        event.request.data = scrub(event.request.data);
      }
      return event;
    },
  });
}
