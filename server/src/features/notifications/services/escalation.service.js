const { getPrisma } = require("../../../core/db/prisma");
const { queueEscalation, queueSmsDelivery } = require("../../../core/queue/notifications");
const { consumeAlertSmsBudget } = require("../../../core/messaging/smsBudget");
const { findEvent } = require("../config/events.config");
const { loadPreferences, decideChannel } = require("./preference.service");
const { contactIssue, targetFor, verifiedReach } = require("./contact");

const MINUTE = 60 * 1000;
const USER_FIELDS = { status: true, phone: true, phoneVerifiedAt: true };

async function scheduleEscalation(notification, event) {
  if (!event.escalation) return;
  await queueEscalation(
    { notificationId: notification.id },
    event.escalation.afterMinutes * MINUTE,
  );
}

async function skipReasonFor({ event, channel, user, notification }) {
  if (user.status !== "ACTIVE") return "inactive";

  const preferences = await loadPreferences([notification.userId]);
  const verdict = decideChannel({ event, channel, entry: preferences.get(notification.userId) });
  if (!verdict.allowed) return verdict.reason;

  const issue = contactIssue(channel, verifiedReach(user));
  if (issue) return issue;

  if (!(await consumeAlertSmsBudget())) return "sms_budget";
  return null;
}

/**
 * Runs after the escalation delay. If the person has neither read nor acknowledged the
 * notification, the fallback channel (SMS) is created and queued. Safe to run twice.
 */
async function runEscalation({ notificationId }) {
  const prisma = getPrisma();
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    include: { user: { select: USER_FIELDS } },
  });
  if (!notification) return { status: "gone" };
  if (notification.readAt || notification.acknowledgedAt) return { status: "answered" };

  const event = findEvent(notification.type);
  if (!event?.escalation) return { status: "not_configured" };

  const { channel } = event.escalation;
  const existing = await prisma.notificationDelivery.findUnique({
    where: { notificationId_channel: { notificationId, channel } },
  });
  if (existing) return { status: "already_escalated" };

  const skipReason = await skipReasonFor({ event, channel, user: notification.user, notification });

  let delivery;
  try {
    delivery = await prisma.notificationDelivery.create({
      data: {
        notificationId,
        channel,
        status: skipReason ? "SKIPPED" : "PENDING",
        skipReason,
        target: skipReason ? null : targetFor(channel, verifiedReach(notification.user)),
      },
    });
  } catch (err) {
    if (err.code === "P2002") return { status: "already_escalated" };
    throw err;
  }

  if (skipReason) return { status: "skipped", reason: skipReason };

  await queueSmsDelivery({ deliveryId: delivery.id });
  return { status: "escalated", deliveryId: delivery.id };
}

module.exports = { scheduleEscalation, runEscalation };
