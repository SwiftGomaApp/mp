const { getConfig } = require("../../config/env.config");
const { getRedis } = require("../cache/redis");
const { generateOtp, hmacSha256, safeEqual } = require("../crypto/crypto");
const { AppError } = require("../errors/AppError");

const PURPOSES = {
  SIGNUP: "signup",
  LOGIN: "login",
  PASSWORD_RESET: "password-reset",
  STEP_UP: "step-up",
  RECOVERY: "recovery",
};

function normalizeTarget(target) {
  return String(target).replace(/\s+/g, "").toLowerCase();
}

function keys(purpose, target) {
  const t = normalizeTarget(target);
  return {
    otp: `otp:${purpose}:${t}`,
    cooldown: `otp-cooldown:${purpose}:${t}`,
    hourly: `otp-hourly:${t}`,
    target: t,
  };
}

function digest(purpose, target, code) {
  return hmacSha256(`${purpose}:${target}:${code}`, getConfig().auth.otpSecret);
}

async function issueOtp({ purpose, target }) {
  const { otpTtlMinutes, otpResendSeconds, otpMaxPerHour } = getConfig().auth;
  const redis = getRedis();
  const k = keys(purpose, target);

  if (otpResendSeconds > 0) {
    const acquired = await redis.set(k.cooldown, "1", "EX", otpResendSeconds, "NX");
    if (!acquired) {
      const retryAfterSeconds = Math.max(await redis.ttl(k.cooldown), 1);
      throw new AppError(
        429,
        "OTP_COOLDOWN",
        `Veuillez patienter ${retryAfterSeconds} secondes avant de demander un nouveau code`,
        { retryAfterSeconds },
      );
    }
  }

  if (otpMaxPerHour > 0) {
    const count = await redis.incr(k.hourly);
    if (count === 1) await redis.expire(k.hourly, 60 * 60);
    if (count > otpMaxPerHour) {
      const retryAfterSeconds = Math.max(await redis.ttl(k.hourly), 1);
      throw new AppError(
        429,
        "OTP_HOURLY_LIMIT",
        `Trop de codes demandés pour ce contact, veuillez réessayer dans ${Math.ceil(retryAfterSeconds / 60)} minutes`,
        { retryAfterSeconds },
      );
    }
  }

  const code = generateOtp(6);

  await redis
    .multi()
    .del(k.otp)
    .hset(k.otp, "hash", digest(purpose, k.target, code), "attempts", 0)
    .expire(k.otp, otpTtlMinutes * 60)
    .exec();

  return { code, expiresMinutes: otpTtlMinutes };
}

async function verifyOtp({ purpose, target, code }) {
  const { otpMaxAttempts } = getConfig().auth;
  const redis = getRedis();
  const k = keys(purpose, target);

  const stored = await redis.hget(k.otp, "hash");
  if (!stored) throw AppError.badRequest("Code invalide ou expiré", undefined, "OTP_INVALID");

  const attempts = await redis.hincrby(k.otp, "attempts", 1);
  if (attempts > otpMaxAttempts) {
    await redis.del(k.otp);
    throw AppError.tooManyRequests(
      "Trop d'essais, veuillez demander un nouveau code",
      "OTP_ATTEMPTS_EXCEEDED",
    );
  }

  if (!safeEqual(stored, digest(purpose, k.target, String(code).trim()))) {
    throw AppError.badRequest("Code invalide ou expiré", undefined, "OTP_INVALID");
  }

  const removed = await redis.del(k.otp);
  if (removed !== 1) throw AppError.badRequest("Code invalide ou expiré", undefined, "OTP_INVALID");
}

module.exports = { OTP_PURPOSES: PURPOSES, issueOtp, verifyOtp };
