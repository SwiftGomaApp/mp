const Redis = require("ioredis");
const { getConfig } = require("../../config/env.config");

let client = null;

function getRedis() {
  if (client) return client;

  const { url, keyPrefix } = getConfig().redis;

  client = new Redis(url, {
    keyPrefix,
    lazyConnect: true,
    maxRetriesPerRequest: 3,
    retryStrategy: (attempt) => Math.min(attempt * 200, 3000),
  });

  client.on("error", (err) => {
    console.error("Redis error:", err.message);
  });

  return client;
}

function createRedisConnection() {
  const { url } = getConfig().redis;

  return new Redis(url, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  });
}

async function connectRedis() {
  const redis = getRedis();
  if (redis.status === "wait") await redis.connect();
  await redis.ping();
  return redis;
}

async function disconnectRedis() {
  if (!client) return;
  await client.quit();
  client = null;
}

async function cacheGet(key) {
  const value = await getRedis().get(key);
  return value === null ? null : JSON.parse(value);
}

async function cacheSet(key, value, ttlSeconds) {
  const payload = JSON.stringify(value);
  if (ttlSeconds) {
    await getRedis().set(key, payload, "EX", ttlSeconds);
  } else {
    await getRedis().set(key, payload);
  }
}

async function cacheDel(key) {
  await getRedis().del(key);
}

async function cacheRemember(key, ttlSeconds, loader) {
  const cached = await cacheGet(key);
  if (cached !== null) return cached;
  const fresh = await loader();
  await cacheSet(key, fresh, ttlSeconds);
  return fresh;
}

module.exports = {
  getRedis,
  createRedisConnection,
  connectRedis,
  disconnectRedis,
  cacheGet,
  cacheSet,
  cacheDel,
  cacheRemember,
};
