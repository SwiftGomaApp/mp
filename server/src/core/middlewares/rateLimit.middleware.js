const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { getRedis } = require("../cache/redis");
const { AppError } = require("../errors/AppError");

function createLimiter({ name, windowMs, limit, keyGenerator, message }) {
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
        store: new RedisStore({
          prefix: `rl:${name}:`,
          sendCommand: (...args) => getRedis().call(...args),
        }),
        handler: (r, s, n) => n(AppError.tooManyRequests(message)),
      });
    }
    return limiter(req, res, next);
  };
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

const otpLimiter = createLimiter({
  name: "otp",
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "Trop de codes demandés, veuillez réessayer plus tard",
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${req.body?.phone || req.body?.email || ""}`,
});

module.exports = { createLimiter, globalLimiter, authLimiter, otpLimiter };
