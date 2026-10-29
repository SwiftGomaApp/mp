const { getRedis } = require("../../../core/cache/redis");
const { logger } = require("../../../core/logger/logger");

const FLOOD_LIMIT_PER_HOUR = 30;
const FLOOD_WINDOW_SECONDS = 60 * 60;
const URGENT = new Set(["HIGH", "CRITICAL"]);

async function hit(key, windowSeconds) {
  const redis = getRedis();
  const count = await redis.incr(key);
  if (count === 1) await redis.expire(key, windowSeconds);
  return count;
}

/**
 * Decides whether the outside channels (push, email, SMS) should be held back for this user.
 * The inbox row is always written; this only limits noise. Fails open if Redis is unavailable.
 * @returns {Promise<string | null>} a skip reason, or null when the notification may go out
 */
async function throttleReason(userId, event) {
  if (event.mandatory) return null;

  try {
    if (event.throttle) {
      const { max, windowSeconds } = event.throttle;
      const count = await hit(`notif-throttle:${userId}:${event.key}`, windowSeconds);
      if (count > max) return "throttled";
    }

    if (!URGENT.has(event.priority)) {
      const count = await hit(`notif-flood:${userId}`, FLOOD_WINDOW_SECONDS);
      if (count > FLOOD_LIMIT_PER_HOUR) return "rate_limited";
    }
  } catch (err) {
    logger.warn({ err, userId, event: event.key }, "Notification throttle unavailable");
  }

  return null;
}

module.exports = { throttleReason, FLOOD_LIMIT_PER_HOUR };
