const { getPrisma } = require("../../../core/db/prisma");
const { getRedis } = require("../../../core/cache/redis");
const { AppError } = require("../../../core/errors/AppError");

const today = () => new Date().toISOString().slice(0, 10);

async function budgetUsage() {
  const redis = getRedis();
  const [otp, alert] = await Promise.all([
    redis.get(`sms-budget:otp:${today()}`),
    redis.get(`sms-budget:alert:${today()}`),
  ]);
  return { otp: Number(otp ?? 0), alert: Number(alert ?? 0) };
}

/** Delivery results over a period, plus why messages were skipped or failed. */
async function deliveryAnalytics({ days }) {
  const prisma = getPrisma();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const where = { createdAt: { gte: since } };

  const [byChannel, skipReasons, failures, byContext, sms, pushOpened] = await Promise.all([
    prisma.notificationDelivery.groupBy({
      by: ["channel", "status"],
      where,
      _count: { _all: true },
    }),
    prisma.notificationDelivery.groupBy({
      by: ["channel", "skipReason"],
      where: { ...where, status: "SKIPPED" },
      _count: { _all: true },
      orderBy: { _count: { skipReason: "desc" } },
      take: 20,
    }),
    prisma.notificationDelivery.groupBy({
      by: ["channel", "error"],
      where: { ...where, status: "FAILED" },
      _count: { _all: true },
      orderBy: { _count: { error: "desc" } },
      take: 10,
    }),
    prisma.notification.groupBy({ by: ["context"], where, _count: { _all: true } }),
    budgetUsage(),
    prisma.notificationDelivery.count({
      where: { ...where, channel: "PUSH", openedAt: { not: null } },
    }),
  ]);

  const channels = {};
  for (const row of byChannel) {
    channels[row.channel] ??= {};
    channels[row.channel][row.status] = row._count._all;
  }

  return {
    days,
    channels,
    notificationsByContext: Object.fromEntries(byContext.map((r) => [r.context, r._count._all])),
    skipReasons: skipReasons.map((r) => ({
      channel: r.channel,
      reason: r.skipReason,
      count: r._count._all,
    })),
    topFailures: failures.map((r) => ({ channel: r.channel, error: r.error, count: r._count._all })),
    smsToday: sms,
    pushOpened,
  };
}

/**
 * Answers "did this person receive the message?" for support. Titles and delivery results
 * only: message bodies are not shown.
 */
async function lookupDeliveries({ userId, email, limit }) {
  const prisma = getPrisma();
  const user = await prisma.user.findFirst({
    where: userId ? { id: userId } : { email: email.toLowerCase() },
    select: { id: true, name: true, role: true, status: true },
  });
  if (!user) throw AppError.notFound("Utilisateur introuvable", "USER_NOT_FOUND");

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      context: true,
      priority: true,
      title: true,
      readAt: true,
      acknowledgedAt: true,
      createdAt: true,
      deliveries: {
        select: {
          channel: true,
          status: true,
          skipReason: true,
          error: true,
          attempts: true,
          sentAt: true,
          deliveredAt: true,
          failedAt: true,
          openedAt: true,
        },
      },
    },
  });

  return { user, notifications };
}

module.exports = { deliveryAnalytics, lookupDeliveries };
