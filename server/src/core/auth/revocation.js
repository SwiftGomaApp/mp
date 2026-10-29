const { getConfig } = require("../../config/env.config");
const { getRedis } = require("../cache/redis");
const { disconnectSession } = require("../realtime/emit");

const key = (sessionId) => `revoked-session:${sessionId}`;

async function markSessionRevoked(sessionId) {
  await getRedis().set(key(sessionId), "1", "EX", getConfig().auth.accessTtlSeconds);
  disconnectSession(sessionId);
}

async function isSessionRevoked(sessionId) {
  return (await getRedis().exists(key(sessionId))) === 1;
}

module.exports = { markSessionRevoked, isSessionRevoked };
