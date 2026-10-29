const { getConfig } = require("../../config/env.config");
const { getRedis } = require("../cache/redis");
const { logger } = require("../logger/logger");

const WINDOW_SECONDS = 60;
const MAX_HANDSHAKES_PER_WINDOW = 60;

function clientIp(req) {
  const { trustProxy } = getConfig();
  if (trustProxy) {
    const hops = String(req.headers["x-forwarded-for"] ?? "")
      .split(",")
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length) return hops[Math.max(hops.length - Number(trustProxy), 0)];
  }
  return req.socket?.remoteAddress ?? "unknown";
}

function isNewHandshake(req) {
  try {
    return !new URL(req.url, "http://localhost").searchParams.has("sid");
  } catch {
    return true;
  }
}

/**
 * Limits how often one address may open new realtime connections. Follow-up polling requests
 * of an existing connection are not counted. Fails open if Redis is unavailable.
 */
async function allowHandshake(req) {
  if (!isNewHandshake(req)) return true;

  try {
    const redis = getRedis();
    const key = `ws-handshake:${clientIp(req)}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, WINDOW_SECONDS);
    return count <= MAX_HANDSHAKES_PER_WINDOW;
  } catch (err) {
    logger.warn({ err }, "Handshake limiter unavailable");
    return true;
  }
}

module.exports = { allowHandshake, clientIp, MAX_HANDSHAKES_PER_WINDOW };
