const { getPrisma } = require("../../../core/db/prisma");
const { logger } = require("../../../core/logger/logger");
const { notify } = require("../../notifications/notify");
const { logActivity } = require("../../auth/services/activity.service");
const { verificationConfig: cfg } = require("../config/verification.config");

// Only the user's latest approved dossier counts: after a renewal, the old one is history.
async function currentDocuments(documents) {
  const prisma = getPrisma();
  const userIds = [...new Set(documents.map((d) => d.case.userId))];

  const latest = new Map();
  for (const userId of userIds) {
    const approved = await prisma.verificationCase.findFirst({
      where: { userId, status: "APPROVED" },
      orderBy: { decidedAt: "desc" },
      select: { id: true },
    });
    if (approved) latest.set(userId, approved.id);
  }

  return documents.filter((d) => latest.get(d.case.userId) === d.caseId);
}

async function tell(userId, event, data) {
  try {
    await notify({ event, userId, data });
  } catch (err) {
    logger.warn({ err, event }, "Failed to notify verification expiry");
  }
}

const approvedCase = { status: "APPROVED", user: { verificationStatus: "APPROVED" } };

// One reminder per document, sent once it is within the reminder window.
async function sendExpiryReminders(now = new Date()) {
  const prisma = getPrisma();
  const limit = new Date(now.getTime() + cfg.expiryReminderMs);

  const due = await prisma.verificationDocument.findMany({
    where: {
      reminderSentAt: null,
      expiresAt: { gt: now, lte: limit },
      case: approvedCase,
    },
    include: { case: { select: { userId: true } } },
  });

  let sent = 0;
  for (const doc of await currentDocuments(due)) {
    // claim the reminder first, so two runs never send it twice
    const claimed = await prisma.verificationDocument.updateMany({
      where: { id: doc.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count !== 1) continue;

    const userId = doc.case.userId;
    await logActivity({
      userId,
      event: "VERIFICATION_EXPIRY_REMINDED",
      metadata: { caseId: doc.caseId, type: doc.type, expiresAt: doc.expiresAt },
    });
    await tell(userId, "verification.expiring", {
      caseId: doc.caseId,
      type: doc.type,
      expiresAt: doc.expiresAt.toISOString(),
    });
    sent += 1;
  }

  if (sent) logger.info({ sent }, "Sent verification expiry reminders");
  return sent;
}

// A dossier whose document has run out is paused until the person sends a new one.
async function pauseExpiredAccounts(now = new Date()) {
  const prisma = getPrisma();

  const expired = await prisma.verificationDocument.findMany({
    where: { expiresAt: { lte: now }, case: approvedCase },
    include: { case: { select: { userId: true } } },
  });

  const byUser = new Map();
  for (const doc of await currentDocuments(expired)) {
    byUser.set(doc.case.userId, doc);
  }

  let paused = 0;
  for (const [userId, doc] of byUser) {
    const result = await prisma.user.updateMany({
      where: { id: userId, verificationStatus: "APPROVED" },
      data: { verificationStatus: "EXPIRED" },
    });
    if (result.count !== 1) continue;

    await logActivity({
      userId,
      event: "VERIFICATION_EXPIRED",
      metadata: { caseId: doc.caseId, type: doc.type },
    });
    await tell(userId, "verification.expired", { caseId: doc.caseId, type: doc.type });
    paused += 1;
  }

  if (paused) logger.info({ paused }, "Paused accounts with an expired document");
  return paused;
}

async function runExpiryChecks() {
  // pause first: a document that ran out gets no reminder
  const paused = await pauseExpiredAccounts();
  const reminded = await sendExpiryReminders();
  return { paused, reminded };
}

module.exports = { sendExpiryReminders, pauseExpiredAccounts, runExpiryChecks };
