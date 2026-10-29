const { getPrisma } = require("../../../core/db/prisma");
const { getCampaign } = require("./campaign.service");

const rate = (part, whole) => (whole ? Math.round((part / whole) * 10000) / 100 : 0);

/**
 * "Sent" means the mail server accepted the message. Plain email gives no delivery receipt,
 * and opens are an estimate because some mail apps preload images for everyone.
 */
async function campaignStats(id) {
  const prisma = getPrisma();
  const campaign = await getCampaign(id);

  const [recipientGroups, eventRows, topLinks] = await Promise.all([
    prisma.campaignRecipient.groupBy({
      by: ["status"],
      where: { campaignId: id },
      _count: { _all: true },
    }),
    prisma.$queryRaw`
      SELECT "type"::text AS type,
             COUNT(*)::int AS total,
             COUNT(DISTINCT "recipientId")::int AS uniq
      FROM "tracking_events"
      WHERE "campaignId" = ${id}
      GROUP BY "type"`,
    prisma.trackingEvent.groupBy({
      by: ["url"],
      where: { campaignId: id, type: "CLICK" },
      _count: { _all: true },
      orderBy: { _count: { url: "desc" } },
      take: 10,
    }),
  ]);

  const recipients = Object.fromEntries(recipientGroups.map((g) => [g.status, g._count._all]));
  const events = Object.fromEntries(eventRows.map((row) => [row.type, row]));
  const sent = recipients.SENT ?? 0;
  const uniqueOpens = events.OPEN?.uniq ?? 0;
  const uniqueClicks = events.CLICK?.uniq ?? 0;
  const unsubscribes = events.UNSUBSCRIBE?.uniq ?? 0;

  return {
    campaign: {
      id: campaign.id,
      name: campaign.name,
      status: campaign.status,
      startedAt: campaign.startedAt,
      completedAt: campaign.completedAt,
    },
    recipients: {
      total: campaign.recipientCount,
      sent,
      failed: recipients.FAILED ?? 0,
      skipped: recipients.SKIPPED ?? 0,
      pending: recipients.PENDING ?? 0,
    },
    engagement: {
      uniqueOpens,
      totalOpens: events.OPEN?.total ?? 0,
      uniqueClicks,
      totalClicks: events.CLICK?.total ?? 0,
      unsubscribes,
      openRate: rate(uniqueOpens, sent),
      clickRate: rate(uniqueClicks, sent),
      unsubscribeRate: rate(unsubscribes, sent),
    },
    topLinks: topLinks.map((row) => ({ url: row.url, clicks: row._count._all })),
  };
}

async function overview({ days }) {
  const prisma = getPrisma();
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const [campaigns, recipients, events, suppressions] = await Promise.all([
    prisma.campaign.groupBy({ by: ["status"], where: { createdAt: { gte: since } }, _count: { _all: true } }),
    prisma.campaignRecipient.groupBy({
      by: ["status"],
      where: { campaign: { createdAt: { gte: since } } },
      _count: { _all: true },
    }),
    prisma.trackingEvent.groupBy({
      by: ["type"],
      where: { campaign: { createdAt: { gte: since } } },
      _count: { _all: true },
    }),
    prisma.emailSuppression.groupBy({
      by: ["reason"],
      where: { createdAt: { gte: since } },
      _count: { _all: true },
    }),
  ]);

  const tally = (rows, key) => Object.fromEntries(rows.map((row) => [row[key], row._count._all]));
  const sent = tally(recipients, "status").SENT ?? 0;
  const byEvent = tally(events, "type");

  return {
    days,
    campaigns: tally(campaigns, "status"),
    recipients: tally(recipients, "status"),
    events: byEvent,
    newSuppressions: tally(suppressions, "reason"),
    totals: {
      sent,
      openRate: rate(byEvent.OPEN ?? 0, sent),
      clickRate: rate(byEvent.CLICK ?? 0, sent),
    },
  };
}

module.exports = { campaignStats, overview, rate };
