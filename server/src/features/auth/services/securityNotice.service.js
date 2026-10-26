const { getPrisma } = require("../../../core/db/prisma");
const { getConfig } = require("../../../config/env.config");
const { logger } = require("../../../core/logger/logger");
const {
  queueSecurityAlertEmail,
  queueSecurityAlertSms,
} = require("../../../core/queue/notifications");

async function notifySecurityChange(userOrId, type) {
  try {
    const user =
      typeof userOrId === "string"
        ? await getPrisma().user.findUnique({ where: { id: userOrId } })
        : userOrId;

    const { activityUrl } = getConfig().mail;
    if (user.email && user.emailVerifiedAt) {
      await queueSecurityAlertEmail({
        to: user.email,
        name: user.name,
        type,
        date: new Date(),
        activityUrl,
      });
    } else if (user.phone && user.phoneVerifiedAt) {
      await queueSecurityAlertSms({ to: user.phone, type });
    }
  } catch (err) {
    logger.warn({ err, type }, "Failed to queue security alert");
  }
}

module.exports = { notifySecurityChange };
