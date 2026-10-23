const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { getRedis } = require("../cache/redis");
const { AppError } = require("../errors/AppError");

function createLimiter({ name, windowMs, limit, keyGenerator, message, createStore }) {
  let limiter = null;

  return (req, res, next) => {
    if (!limiter) {
      limiter = rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        passOnStoreError: true,
        validate: { creationStack: false },
        keyGenerator: keyGenerator || ((r) => ipKeyGenerator(r.ip)),
        ...(createStore
          ? { store: createStore() }
          : {
              store: new RedisStore({
                prefix: `rl:${name}:`,
                sendCommand: (...args) => getRedis().call(...args),
              }),
            }),
        handler: (r, s, n) => n(AppError.tooManyRequests(message)),
      });
    }
    return limiter(req, res, next);
  };
}

function normalizeTarget(req) {
  const raw = req.body?.phone || req.body?.email;
  const value = String(raw ?? "")
    .replace(/\s+/g, "")
    .toLowerCase();
  return value || ipKeyGenerator(req.ip);
}

function createOtpLimiters({ createStore } = {}) {
  const message = "Trop de codes demandés, veuillez réessayer plus tard";

  return [
    createLimiter({
      name: "otp-ip",
      windowMs: 60 * 60 * 1000,
      limit: 10,
      message,
      createStore,
    }),
    createLimiter({
      name: "otp-target",
      windowMs: 60 * 60 * 1000,
      limit: 5,
      message,
      keyGenerator: normalizeTarget,
      createStore,
    }),
  ];
}

const globalLimiter = createLimiter({
  name: "global",
  windowMs: 60 * 1000,
  limit: 120,
});

const authLimiter = createLimiter({
  name: "auth",
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: "Trop de tentatives, veuillez réessayer dans quelques minutes",
});

const stepUpLimiter = createLimiter({
  name: "step-up",
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "Trop de codes demandés, veuillez réessayer plus tard",
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip),
});

const otpLimiter = createOtpLimiters();

module.exports = {
  createLimiter,
  createOtpLimiters,
  normalizeTarget,
  globalLimiter,
  authLimiter,
  stepUpLimiter,
  otpLimiter,
};
