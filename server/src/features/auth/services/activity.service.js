const { getPrisma } = require("../../../core/db/prisma");
const { logger } = require("../../../core/logger/logger");

async function logActivity(entry) {
  try {
    await getPrisma().activityLog.create({ data: entry });
  } catch (err) {
    logger.warn({ err, event: entry.event }, "Failed to write activity log");
  }
}

module.exports = { logActivity };
