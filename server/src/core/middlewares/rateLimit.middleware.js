const { rateLimit, ipKeyGenerator } = require("express-rate-limit");
const { RedisStore } = require("rate-limit-redis");
const { getRedis } = require("../cache/redis");
const { AppError } = require("../errors/AppError");
const { sha256 } = require("../crypto/crypto");
const { REFRESH_COOKIE } = require("../auth/cookies");

function createLimiter({
  name,
  windowMs,
  limit,
  keyGenerator,
  message,
  createStore,
  failOpen = false,
}) {
  let limiter = null;

  return (req, res, next) => {
    if (!limiter) {
      limiter = rateLimit({
        windowMs,
        limit,
        standardHeaders: "draft-7",
        legacyHeaders: false,
        passOnStoreError: failOpen,
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
      limit: 30,
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
  failOpen: true,
});

const stepUpLimiter = createLimiter({
  name: "step-up",
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: "Trop de codes demandés, veuillez réessayer plus tard",
  keyGenerator: (req) => req.auth?.userId ?? ipKeyGenerator(req.ip),
});

function perRouteKey(req) {
  return `${ipKeyGenerator(req.ip)}|${req.method} ${req.baseUrl}${req.route?.path ?? req.path}`;
}

function refreshKey(req) {
  const token = req.body?.refreshToken ?? req.cookies?.[REFRESH_COOKIE];
  return token ? `token:${sha256(token).slice(0, 32)}` : `ip:${ipKeyGenerator(req.ip)}`;
}

function createAuthLimiters({ createStore } = {}) {
  const message = "Trop de tentatives, veuillez réessayer dans quelques minutes";

  return {
    authLimiter: createLimiter({
      name: "auth",
      windowMs: 15 * 60 * 1000,
      limit: 100,
      message,
      keyGenerator: perRouteKey,
      createStore,
    }),
    refreshLimiter: createLimiter({
      name: "refresh",
      windowMs: 15 * 60 * 1000,
      limit: 60,
      message,
      keyGenerator: refreshKey,
      createStore,
    }),
  };
}

const otpLimiter = createOtpLimiters();
const { authLimiter, refreshLimiter } = createAuthLimiters();

module.exports = {
  createLimiter,
  createOtpLimiters,
  createAuthLimiters,
  normalizeTarget,
  globalLimiter,
  authLimiter,
  stepUpLimiter,
  refreshLimiter,
  otpLimiter,
};
