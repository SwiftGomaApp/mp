const { getPrisma } = require("../../../core/db/prisma");
const { logger } = require("../../../core/logger/logger");
const { emitToUser, isUserOnline } = require("../../../core/realtime/emit");
const {
  queuePushDelivery,
  queueEmailDelivery,
  queueSmsDelivery,
} = require("../../../core/queue/notifications");
const { getEvent } = require("../config/events.config");
const { loadPreferences, decideChannel } = require("./preference.service");
const { countUnread } = require("./inbox.service");
const { resolveReach, contactIssue, targetFor } = require("./contact");
const { throttleReason } = require("./throttle.service");
const { scheduleEscalation } = require("./escalation.service");

const CHUNK_SIZE = 25;
const PUSH_ONLINE_BYPASS = new Set(["HIGH", "CRITICAL"]);
const CHANNEL_ORDER = ["IN_APP", "PUSH", "EMAIL", "SMS"];

function assertRequired(event, data) {
  const missing = event.required.filter((key) => data[key] === undefined || data[key] === null);
  if (missing.length) {
    throw new Error(`Event ${event.key} is missing: ${missing.join(", ")}`);
  }
}

function isEligible(event, user) {
  if (!user) return false;
  if (user.status === "DELETED" || user.status === "BANNED") return false;
  if (user.status === "SUSPENDED" && event.context !== "SECURITY") return false;
  if (event.roles && !event.roles.includes(user.role)) return false;
  return true;
}

function hasTemplate(event, channel) {
  if (channel !== "EMAIL" && channel !== "SMS") return true;
  return Boolean(event[channel.toLowerCase()]);
}

function planChannels(event, reach, entry, now, throttled = null) {
  const plan = event.channels
    .filter((channel) => SENDERS[channel] && hasTemplate(event, channel))
    .map((channel) => {
      const verdict = decideChannel({ event, channel, entry, now });
      let skipReason = verdict.allowed ? contactIssue(channel, reach) : verdict.reason;
      if (!skipReason && throttled && channel !== "IN_APP") skipReason = throttled;
      return { channel, skipReason, target: targetFor(channel, reach) };
    });

  if (event.smsFallbackOnly) {
    const email = plan.find((item) => item.channel === "EMAIL");
    const sms = plan.find((item) => item.channel === "SMS");
    if (email && sms && !sms.skipReason && email.skipReason !== "no_email") {
      sms.skipReason = "email_preferred";
    }
  }

  return plan;
}

function toPublic(notification) {
  const { id, type, context, priority, title, body, data, readAt, createdAt } = notification;
  return { id, type, context, priority, title, body, data, readAt, createdAt };
}

async function markDelivery(id, status, extra = {}) {
  await getPrisma().notificationDelivery.update({
    where: { id },
    data: { status, ...extra },
  });
}

const SENDERS = {
  async IN_APP({ notification, delivery }) {
    const unreadCount = await countUnread(notification.userId);
    emitToUser(notification.userId, "notification:new", {
      notification: toPublic(notification),
      unreadCount,
    });
    await markDelivery(delivery.id, "SENT", { sentAt: new Date() });
  },

  async PUSH({ notification, delivery, event }) {
    if (!PUSH_ONLINE_BYPASS.has(event.priority) && (await isUserOnline(notification.userId))) {
      await markDelivery(delivery.id, "SKIPPED", { skipReason: "user_online" });
      return;
    }
    await queuePushDelivery({ deliveryId: delivery.id });
  },

  async EMAIL({ delivery }) {
    await queueEmailDelivery({ deliveryId: delivery.id });
  },

  async SMS({ delivery }) {
    await queueSmsDelivery({ deliveryId: delivery.id });
  },
};

async function notifyOne({ event, user, data, dedupeKey, contacts, entry, now }) {
  const safeData = JSON.parse(JSON.stringify(data));
  const { title, body } = event.render(safeData);
  const throttled = await throttleReason(user.id, event);
  const plan = planChannels(event, resolveReach(user, contacts), entry, now, throttled);
  const key = dedupeKey ?? event.dedupe?.(safeData) ?? null;

  let notification;
  try {
    notification = await getPrisma().notification.create({
      data: {
        userId: user.id,
        type: event.key,
        context: event.context,
        priority: event.priority,
        title,
        body,
        data: safeData,
        dedupeKey: key,
        expiresAt: event.ttlDays ? new Date(now.getTime() + event.ttlDays * 86_400_000) : null,
        deliveries: {
          create: plan.map(({ channel, skipReason, target }) => ({
            channel,
            status: skipReason ? "SKIPPED" : "PENDING",
            skipReason,
            target: skipReason ? null : target,
          })),
        },
      },
      include: { deliveries: true },
    });
  } catch (err) {
    if (err.code === "P2002") return { userId: user.id, status: "deduped" };
    throw err;
  }

  const pending = notification.deliveries
    .filter((delivery) => delivery.status === "PENDING")
    .sort((a, b) => CHANNEL_ORDER.indexOf(a.channel) - CHANNEL_ORDER.indexOf(b.channel));

  for (const delivery of pending) {
    try {
      await SENDERS[delivery.channel]({ notification, delivery, event });
    } catch (err) {
      logger.warn(
        { err, channel: delivery.channel, notificationId: notification.id },
        "Notification channel failed",
      );
      await markDelivery(delivery.id, "FAILED", {
        error: String(err.message).slice(0, 500),
        failedAt: new Date(),
      }).catch(() => {});
    }
  }

  await scheduleEscalation(notification, event).catch((err) => {
    logger.warn({ err, notificationId: notification.id }, "Could not schedule escalation");
  });

  return { userId: user.id, status: "sent", notificationId: notification.id };
}

/**
 * Raises a notification. `contacts` ({ email, phone }) is only honoured for a single recipient
 * and replaces the person's current contacts as the place email and SMS are sent.
 */
async function notify({ event: key, userId, userIds = [], data = {}, dedupeKey, contacts }) {
  try {
    const event = getEvent(key);
    assertRequired(event, data);

    const ids = [...new Set([userId, ...userIds].filter(Boolean))];
    if (!ids.length) return [];

    const prisma = getPrisma();
    const [users, preferences] = await Promise.all([
      prisma.user.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          name: true,
          role: true,
          status: true,
          email: true,
          emailVerifiedAt: true,
          phone: true,
          phoneVerifiedAt: true,
        },
      }),
      loadPreferences(ids),
    ]);
    const byId = new Map(users.map((user) => [user.id, user]));
    const now = new Date();
    const results = [];

    for (let i = 0; i < ids.length; i += CHUNK_SIZE) {
      const chunk = ids.slice(i, i + CHUNK_SIZE);
      const settled = await Promise.allSettled(
        chunk.map(async (id) => {
          const user = byId.get(id);
          if (!isEligible(event, user)) return { userId: id, status: "ineligible" };
          return notifyOne({
            event,
            user,
            data,
            dedupeKey: ids.length === 1 ? dedupeKey : undefined,
            contacts: ids.length === 1 ? contacts : undefined,
            entry: preferences.get(id),
            now,
          });
        }),
      );

      settled.forEach((outcome, index) => {
        if (outcome.status === "fulfilled") return results.push(outcome.value);
        logger.error({ err: outcome.reason, event: key, userId: chunk[index] }, "Notify failed");
        results.push({ userId: chunk[index], status: "failed" });
      });
    }

    return results;
  } catch (err) {
    logger.error({ err, event: key }, "Notify failed");
    return [];
  }
}

module.exports = { notify };
