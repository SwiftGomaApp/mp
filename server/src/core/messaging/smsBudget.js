const { getConfig } = require("../../config/env.config");
const { getRedis } = require("../cache/redis");
const { AppError } = require("../errors/AppError");

const today = () => new Date().toISOString().slice(0, 10);

async function takeFromBudget(scope, limit) {
  if (!limit) return true;

  const redis = getRedis();
  const key = `sms-budget:${scope}:${today()}`;
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, 48 * 60 * 60);

  return count <= limit;
}

async function assertSmsBudget() {
  if (!(await takeFromBudget("otp", getConfig().sms.dailyOtpLimit))) {
    throw AppError.tooManyRequests(
      "Les codes par SMS sont temporairement indisponibles, réessayez plus tard",
      "SMS_BUDGET_EXCEEDED",
    );
  }
}

async function consumeAlertSmsBudget() {
  return takeFromBudget("alert", getConfig().sms.dailyAlertLimit);
}

module.exports = { assertSmsBudget, consumeAlertSmsBudget };
