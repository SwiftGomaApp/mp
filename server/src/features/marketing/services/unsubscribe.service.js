const { getPrisma } = require("../../../core/db/prisma");
const { logger } = require("../../../core/logger/logger");

/**
 * Stops marketing email to an address. The suppression row keeps working even if the person
 * has no account anymore, and the account's consent flag is switched off as well.
 */
async function unsubscribeEmail({ email, campaignId, recipientId }) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return { unsubscribed: false };

  const prisma = getPrisma();

  // An existing BOUNCED or COMPLAINED record is stronger than an unsubscribe: keep it.
  await prisma.emailSuppression.upsert({
    where: { email: normalized },
    create: { email: normalized, reason: "UNSUBSCRIBED", source: "link" },
    update: {},
  });

  await prisma.notificationSettings.updateMany({
    where: { user: { email: normalized } },
    data: { marketingEmailOptIn: false, marketingEmailOptedAt: null },
  });

  if (campaignId) {
    await prisma.trackingEvent
      .create({ data: { campaignId, recipientId: recipientId ?? null, type: "UNSUBSCRIBE" } })
      .catch((err) => logger.debug({ err }, "Could not record the unsubscribe event"));
  }

  return { unsubscribed: true };
}

/** Removes an unsubscribe record when the person opts back in themselves. */
async function allowEmailAgain(email) {
  const normalized = String(email ?? "").trim().toLowerCase();
  if (!normalized) return;
  await getPrisma().emailSuppression.deleteMany({
    where: { email: normalized, reason: "UNSUBSCRIBED" },
  });
}

module.exports = { unsubscribeEmail, allowEmailAgain };
