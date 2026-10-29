const { getPrisma } = require("../../../core/db/prisma");

async function registerDevice(userId, sessionId, { subscriptionId, deviceId, platform }) {
  const prisma = getPrisma();
  const now = new Date();

  const [device] = await prisma.$transaction([
    prisma.deviceRegistration.upsert({
      where: { subscriptionId },
      create: { userId, subscriptionId, deviceId, platform, sessionId, lastSeenAt: now },
      update: { userId, deviceId, platform, sessionId, lastSeenAt: now, disabledAt: null },
      select: { id: true },
    }),
    prisma.deviceRegistration.updateMany({
      where: { userId, deviceId, subscriptionId: { not: subscriptionId }, disabledAt: null },
      data: { disabledAt: now },
    }),
  ]);

  return { id: device.id };
}

async function removeDevice(userId, subscriptionId) {
  const { count } = await getPrisma().deviceRegistration.deleteMany({
    where: { userId, subscriptionId },
  });
  return { removed: count };
}

module.exports = { registerDevice, removeDevice };
