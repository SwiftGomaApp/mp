const { getPrisma } = require("../../../core/db/prisma");
const { getConfig } = require("../../../config/env.config");
const { AppError } = require("../../../core/errors/AppError");
const mail = require("../../../core/mail/mail.service");
const sms = require("../../../core/messaging/sms.service");
const { sendPush } = require("../providers/onesignal.provider");
const { findEvent } = require("../config/events.config");

const PUSH_TTL_SECONDS = 24 * 60 * 60;
const HIGH_PRIORITY = new Set(["HIGH", "CRITICAL"]);
const USER_FIELDS = {
  name: true,
  role: true,
  email: true,
  emailVerifiedAt: true,
  phone: true,
  phoneVerifiedAt: true,
};

const activityUrl = () => getConfig().mail.activityUrl;
const asDate = (value) => (value ? new Date(value) : new Date());

const EMAIL_TEMPLATES = {
  securityAlert: (d, user) =>
    mail.sendSecurityAlertEmail({
      to: user.email,
      name: user.name,
      type: d.type,
      date: asDate(d.date),
      activityUrl: activityUrl(),
    }),
  loginAlert: (d, user) =>
    mail.sendLoginAlertEmail({
      to: user.email,
      name: user.name,
      deviceName: d.deviceName,
      location: d.location,
      country: d.country,
      date: asDate(d.date),
      activityUrl: activityUrl(),
    }),
  welcome: (d, user) => mail.sendWelcomeEmail({ to: user.email, name: user.name, role: user.role }),
};

const SMS_TEMPLATES = {
  securityAlert: (d, user) => sms.sendSecurityAlertSms({ to: user.phone, type: d.type }),
  loginAlert: (d, user) =>
    sms.sendLoginAlertSms({ to: user.phone, deviceName: d.deviceName, location: d.location }),
  welcome: (d, user) => sms.sendWelcomeSms({ to: user.phone, name: user.name, role: user.role }),
  generic: (d, user, notification) =>
    sms.sendNotificationSms({ to: user.phone, title: notification.title, body: notification.body }),
};

function isPermanent(err) {
  return err instanceof AppError && err.status >= 400 && err.status < 500 && err.status !== 429;
}

/**
 * Picks the OneSignal subscriptions to notify. Only devices whose login session is still
 * alive are used, so a phone that was signed out remotely stops receiving this account's
 * pushes. A user who never registered a device falls back to targeting by user id.
 */
async function pushTargets(userId) {
  const prisma = getPrisma();
  const registrations = await prisma.deviceRegistration.findMany({
    where: { userId, disabledAt: null },
    select: { subscriptionId: true, sessionId: true },
  });

  if (!registrations.length) {
    const everRegistered = await prisma.deviceRegistration.count({ where: { userId } });
    return everRegistered ? null : { userIds: [userId] };
  }

  const sessionIds = registrations.map((r) => r.sessionId).filter(Boolean);
  const live = sessionIds.length
    ? await prisma.session.findMany({
        where: { id: { in: sessionIds }, revokedAt: null, expiresAt: { gt: new Date() } },
        select: { id: true },
      })
    : [];
  const liveIds = new Set(live.map((s) => s.id));

  const subscriptionIds = registrations
    .filter((r) => !r.sessionId || liveIds.has(r.sessionId))
    .map((r) => r.subscriptionId);

  return subscriptionIds.length ? { subscriptionIds } : null;
}

const CHANNELS = {
  async PUSH({ notification, delivery, event }) {
    if (notification.readAt) return { skip: "already_read" };

    const targets = await pushTargets(notification.userId);
    if (!targets) return { skip: "no_active_device" };

    const text = event?.pushText?.(notification.data ?? {}) ?? {
      title: notification.title,
      body: notification.body,
    };

    const result = await sendPush({
      ...targets,
      title: text.title,
      body: text.body,
      data: { notificationId: notification.id, type: notification.type },
      priority: HIGH_PRIORITY.has(notification.priority) ? 10 : 5,
      ttl: PUSH_TTL_SECONDS,
      idempotencyKey: delivery.id,
    });

    if (result.status === "NoSubscribers" || result.status === "NoTargets") {
      return { skip: "no_device" };
    }
    return { provider: "onesignal", providerRef: result.id };
  },

  async EMAIL({ notification, delivery, event, user }) {
    const to = delivery.target ?? (user.email && user.emailVerifiedAt ? user.email : null);
    if (!to) return { skip: "no_email" };
    const send = EMAIL_TEMPLATES[event?.email];
    if (!send) return { skip: "no_template" };

    const info = await send(notification.data ?? {}, { ...user, email: to });
    return { provider: "smtp", providerRef: info?.messageId ?? null };
  },

  async SMS({ notification, delivery, event, user }) {
    const to = delivery.target ?? (user.phone && user.phoneVerifiedAt ? user.phone : null);
    if (!to) return { skip: "no_phone" };
    const send = SMS_TEMPLATES[event?.sms];
    if (!send) return { skip: "no_template" };

    const result = await send(notification.data ?? {}, { ...user, phone: to }, notification);
    return { provider: "africastalking", providerRef: result?.messageId ?? null };
  },
};

async function runDelivery(channel, { deliveryId }, job) {
  const prisma = getPrisma();
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    include: { notification: { include: { user: { select: USER_FIELDS } } } },
  });
  if (!delivery || delivery.status !== "PENDING") return;

  const { notification } = delivery;
  const skip = (skipReason) =>
    prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: { status: "SKIPPED", skipReason },
    });

  const attempt = (job?.attemptsMade ?? 0) + 1;
  const isLastAttempt = attempt >= (job?.opts?.attempts ?? 1);

  try {
    const outcome = await CHANNELS[channel]({
      notification,
      delivery,
      event: findEvent(notification.type),
      user: notification.user,
    });
    if (outcome.skip) return skip(outcome.skip);

    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        status: "SENT",
        provider: outcome.provider,
        providerRef: outcome.providerRef,
        attempts: attempt,
        sentAt: new Date(),
      },
    });
  } catch (err) {
    const final = isLastAttempt || isPermanent(err);
    await prisma.notificationDelivery.update({
      where: { id: delivery.id },
      data: {
        attempts: attempt,
        error: String(err.message).slice(0, 500),
        ...(final ? { status: "FAILED", failedAt: new Date() } : {}),
      },
    });
    throw err;
  }
}

const deliverPush = (data, job) => runDelivery("PUSH", data, job);
const deliverEmail = (data, job) => runDelivery("EMAIL", data, job);
const deliverSms = (data, job) => runDelivery("SMS", data, job);

module.exports = { deliverPush, deliverEmail, deliverSms };
