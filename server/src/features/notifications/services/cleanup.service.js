const { getPrisma } = require("../../../core/db/prisma");
const { logger } = require("../../../core/logger/logger");

const DAY = 24 * 60 * 60 * 1000;
const DISABLED_DEVICE_RETENTION_DAYS = 30;
const INACTIVE_DEVICE_RETENTION_DAYS = 120;

async function cleanNotifications() {
  const prisma = getPrisma();
  const now = new Date();
  const ago = (days) => new Date(now.getTime() - days * DAY);

  const notifications = await prisma.notification.deleteMany({
    where: { expiresAt: { lt: now } },
  });

  const devices = await prisma.deviceRegistration.deleteMany({
    where: {
      OR: [
        { disabledAt: { lt: ago(DISABLED_DEVICE_RETENTION_DAYS) } },
        { lastSeenAt: { lt: ago(INACTIVE_DEVICE_RETENTION_DAYS) } },
      ],
    },
  });

  logger.info(
    { notifications: notifications.count, devices: devices.count },
    "Deleted expired notifications and stale devices",
  );

  return { notifications: notifications.count, devices: devices.count };
}

module.exports = { cleanNotifications };
