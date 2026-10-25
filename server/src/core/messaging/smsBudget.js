const { getConfig } = require("../../config/env.config");
const { getRedis } = require("../cache/redis");
const { AppError } = require("../errors/AppError");

async function assertSmsBudget() {
  const limit = getConfig().sms.dailyOtpLimit;
  if (!limit) return;

  const redis = getRedis();
  const key = `sms-budget:otp:${new Date().toISOString().slice(0, 10)}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 48 * 60 * 60);

  if (count > limit) {
    throw AppError.tooManyRequests(
      "Les codes par SMS sont temporairement indisponibles, réessayez plus tard",
      "SMS_BUDGET_EXCEEDED",
    );
  }
}

module.exports = { assertSmsBudget };
