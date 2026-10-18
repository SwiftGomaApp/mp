const { getPrisma } = require("../../../core/db/prisma");
const { getRedis } = require("../../../core/cache/redis");
const { isShuttingDown } = require("../../../core/shutdown");

async function check(req, res, next) {
  if (isShuttingDown()) return res.status(503).json({ status: "shutting_down" });
  try {
    await Promise.all([getPrisma().$queryRaw`SELECT 1`, getRedis().ping()]);
    res.json({ status: "ok", database: "up", redis: "up" });
  } catch (err) {
    next(err);
  }
}

module.exports = { check };
