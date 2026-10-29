const { getPrisma } = require("../../../core/db/prisma");
const { getConfig } = require("../../../config/env.config");
const { logger } = require("../../../core/logger/logger");
const { sendMarketingMail } = require("../../../core/mail/mailer");
const { queueCampaignStart, queueCampaignBatch } = require("../../../core/queue/marketing");
const { iterateAudience } = require("./segment.service");
const { composeCampaignEmail } = require("./compose");

const BATCH_MAX = 50;
const SEND_CONCURRENCY = 5;
const STALE_SENDING_MS = 10 * 60 * 1000;

async function refreshCounters(campaignId) {
  const prisma = getPrisma();
  const groups = await prisma.campaignRecipient.groupBy({
    by: ["status"],
    where: { campaignId },
    _count: { _all: true },
  });
  const count = (status) => groups.find((g) => g.status === status)?._count._all ?? 0;

  await prisma.campaign.update({
    where: { id: campaignId },
    data: {
      sentCount: count("SENT"),
      failedCount: count("FAILED"),
      skippedCount: count("SKIPPED"),
    },
  });
  return count("PENDING");
}

async function failCampaign(campaignId, reason) {
  const prisma = getPrisma();
  await prisma.campaign.updateMany({
    where: { id: campaignId, status: "SENDING" },
    data: { status: "FAILED", failureReason: String(reason).slice(0, 500), completedAt: new Date() },
  });
  await prisma.campaignRecipient.updateMany({
    where: { campaignId, status: "PENDING" },
    data: { status: "SKIPPED", skipReason: "campaign_failed" },
  });
}

async function finishCampaign(campaignId) {
  await refreshCounters(campaignId);
  await getPrisma().campaign.updateMany({
    where: { id: campaignId, status: "SENDING" },
    data: { status: "SENT", completedAt: new Date() },
  });
}

/**
 * Freezes the audience: one row per recipient, with unsubscribed addresses already skipped.
 * Later changes to the segment do not affect a campaign that has started.
 */
async function startCampaign({ campaignId }) {
  const prisma = getPrisma();
  const { maxRecipients } = getConfig().marketing;

  const { count } = await prisma.campaign.updateMany({
    where: { id: campaignId, status: "SCHEDULED" },
    data: { status: "SENDING", startedAt: new Date() },
  });
  if (!count) return { status: "not_scheduled" };

  const campaign = await prisma.campaign.findUnique({
    where: { id: campaignId },
    include: { segment: true },
  });

  let total = 0;
  let suppressed = 0;

  try {
    for await (const page of iterateAudience(campaign.segment?.rules ?? {})) {
      total += page.length;
      if (total > maxRecipients) throw new Error(`Audience exceeds ${maxRecipients} recipients`);

      const emails = page.map((user) => user.email.toLowerCase());
      const blocked = new Set(
        (
          await prisma.emailSuppression.findMany({
            where: { email: { in: emails } },
            select: { email: true },
          })
        ).map((row) => row.email),
      );

      await prisma.campaignRecipient.createMany({
        data: page.map((user) => {
          const email = user.email.toLowerCase();
          const isBlocked = blocked.has(email);
          if (isBlocked) suppressed += 1;
          return {
            campaignId,
            userId: user.id,
            email,
            name: user.name,
            status: isBlocked ? "SKIPPED" : "PENDING",
            skipReason: isBlocked ? "suppressed" : null,
          };
        }),
        skipDuplicates: true,
      });
    }
  } catch (err) {
    logger.error({ err, campaignId }, "Could not prepare the campaign audience");
    await failCampaign(campaignId, err.message);
    return { status: "failed" };
  }

  await prisma.campaign.update({ where: { id: campaignId }, data: { recipientCount: total } });

  if (total - suppressed <= 0) {
    await finishCampaign(campaignId);
    return { status: "empty" };
  }

  await queueCampaignBatch(campaignId);
  return { status: "started", recipients: total };
}

async function consentFor(recipients) {
  const prisma = getPrisma();
  const [suppressed, optedIn] = await Promise.all([
    prisma.emailSuppression.findMany({
      where: { email: { in: recipients.map((r) => r.email) } },
      select: { email: true },
    }),
    prisma.notificationSettings.findMany({
      where: { userId: { in: recipients.map((r) => r.userId) }, marketingEmailOptIn: true },
      select: { userId: true },
    }),
  ]);
  return {
    suppressed: new Set(suppressed.map((row) => row.email)),
    optedIn: new Set(optedIn.map((row) => row.userId)),
  };
}

async function deliverTo(campaign, recipient, consent) {
  const prisma = getPrisma();
  const mark = (data) => prisma.campaignRecipient.update({ where: { id: recipient.id }, data });

  if (consent.suppressed.has(recipient.email)) {
    return mark({ status: "SKIPPED", skipReason: "suppressed" });
  }
  if (!consent.optedIn.has(recipient.userId)) {
    return mark({ status: "SKIPPED", skipReason: "opted_out" });
  }

  try {
    const message = composeCampaignEmail({ campaign, recipient });
    const info = await sendMarketingMail({ to: recipient.email, ...message });
    return mark({ status: "SENT", sentAt: new Date(), providerRef: info?.messageId ?? null });
  } catch (err) {
    logger.warn({ err, campaignId: campaign.id, recipientId: recipient.id }, "Campaign email failed");
    return mark({ status: "FAILED", error: String(err.message).slice(0, 500) });
  }
}

/**
 * Sends one small batch, then queues the next after a pause. The pause is what turns
 * MARKETING_EMAILS_PER_MINUTE into a real rate limit and lets a new sender warm up gradually.
 */
async function sendBatch({ campaignId }) {
  const prisma = getPrisma();
  const campaign = await prisma.campaign.findUnique({ where: { id: campaignId } });
  if (!campaign || campaign.status !== "SENDING") return { status: "stopped" };

  const { perMinute } = getConfig().marketing;
  const size = Math.min(BATCH_MAX, perMinute);

  const batch = await prisma.campaignRecipient.findMany({
    where: { campaignId, status: "PENDING" },
    orderBy: { id: "asc" },
    take: size,
  });
  if (!batch.length) {
    await finishCampaign(campaignId);
    return { status: "finished" };
  }

  const consent = await consentFor(batch);
  for (let i = 0; i < batch.length; i += SEND_CONCURRENCY) {
    await Promise.all(
      batch.slice(i, i + SEND_CONCURRENCY).map((recipient) => deliverTo(campaign, recipient, consent)),
    );
  }

  const pending = await refreshCounters(campaignId);
  if (!pending) {
    await finishCampaign(campaignId);
    return { status: "finished" };
  }

  await queueCampaignBatch(campaignId, Math.ceil((size / perMinute) * 60 * 1000));
  return { status: "continues", pending };
}

/** Runs every minute: starts due campaigns and recovers ones whose sending stalled. */
async function dispatchDue() {
  const prisma = getPrisma();
  const now = new Date();

  const due = await prisma.campaign.findMany({
    where: { status: "SCHEDULED", scheduledAt: { lte: now } },
    select: { id: true },
  });
  for (const { id } of due) await queueCampaignStart(id);

  const stalled = await prisma.campaign.findMany({
    where: { status: "SENDING", updatedAt: { lt: new Date(now.getTime() - STALE_SENDING_MS) } },
    select: { id: true, recipientCount: true },
  });
  for (const campaign of stalled) {
    if (!campaign.recipientCount) {
      await failCampaign(campaign.id, "Audience preparation was interrupted");
    } else {
      await queueCampaignBatch(campaign.id);
    }
  }

  return { started: due.length, recovered: stalled.length };
}

module.exports = { startCampaign, sendBatch, dispatchDue };
