import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { loadWithMocks } from "../helpers/mockModules.mjs";

const require = createRequire(import.meta.url);
const { AppError } = require("../../src/core/errors/AppError");

let seq = 0;
const db = {
  users: new Map(),
  prefs: [],
  settings: [],
  notifications: [],
  deliveries: new Map(),
  devices: [],
  sessions: [],
};

function resetDb() {
  db.users.clear();
  db.prefs = [];
  db.settings = [];
  db.notifications = [];
  db.deliveries.clear();
  db.devices = [];
  db.sessions = [];
}

const fakePrisma = {
  deviceRegistration: {
    findMany: async ({ where }) =>
      db.devices.filter((d) => d.userId === where.userId && !d.disabledAt),
    count: async ({ where }) => db.devices.filter((d) => d.userId === where.userId).length,
  },
  session: {
    findMany: async ({ where }) =>
      db.sessions.filter((s) => where.id.in.includes(s.id) && !s.revokedAt && s.expiresAt > new Date()),
  },
  user: {
    findMany: async ({ where }) => where.id.in.map((id) => db.users.get(id)).filter(Boolean),
  },
  notificationPreference: {
    findMany: async ({ where }) => db.prefs.filter((p) => where.userId.in.includes(p.userId)),
  },
  notificationSettings: {
    findMany: async ({ where }) => db.settings.filter((s) => where.userId.in.includes(s.userId)),
  },
  notification: {
    create: async ({ data }) => {
      const clash = db.notifications.some(
        (n) => data.dedupeKey && n.userId === data.userId && n.dedupeKey === data.dedupeKey,
      );
      if (clash) throw Object.assign(new Error("unique"), { code: "P2002" });

      const { deliveries, ...rest } = data;
      const notification = { id: `n${++seq}`, readAt: null, createdAt: new Date(), ...rest };
      notification.deliveries = deliveries.create.map((d) => {
        const row = { id: `d${++seq}`, notificationId: notification.id, attempts: 0, ...d };
        db.deliveries.set(row.id, row);
        return row;
      });
      db.notifications.push(notification);
      return notification;
    },
    count: async ({ where }) =>
      db.notifications.filter((n) => n.userId === where.userId && !n.readAt).length,
  },
  notificationDelivery: {
    update: async ({ where, data }) => Object.assign(db.deliveries.get(where.id), data),
    findUnique: async ({ where }) => {
      const delivery = db.deliveries.get(where.id);
      if (!delivery) return null;
      const notification = db.notifications.find((n) => n.id === delivery.notificationId);
      return { ...delivery, notification: { ...notification, user: db.users.get(notification.userId) } };
    },
  },
};

const emitted = [];
const queued = { push: [], email: [], sms: [] };
let online = false;

const emit = {
  emitToUser: (userId, event, payload) => emitted.push({ userId, event, payload }),
  isUserOnline: async () => online,
};
const queue = {
  queuePushDelivery: async (d) => queued.push.push(d),
  queueEmailDelivery: async (d) => queued.email.push(d),
  queueSmsDelivery: async (d) => queued.sms.push(d),
};

const throttle = { throttleReason: vi.fn(async () => null) };
const escalation = { scheduleEscalation: vi.fn(async () => undefined) };

const { notify } = loadWithMocks("features/notifications/services/dispatcher.service.js", {
  "core/db/prisma.js": { getPrisma: () => fakePrisma },
  "core/realtime/emit.js": emit,
  "core/queue/notifications.js": queue,
  "features/notifications/services/throttle.service.js": throttle,
  "features/notifications/services/escalation.service.js": escalation,
});

const pushProvider = { sendPush: vi.fn() };
const mail = {
  sendSecurityAlertEmail: vi.fn(async () => ({ messageId: "mail-1" })),
  sendLoginAlertEmail: vi.fn(async () => ({ messageId: "mail-2" })),
  sendWelcomeEmail: vi.fn(async () => ({ messageId: "mail-3" })),
};
const smsService = {
  sendSecurityAlertSms: vi.fn(async () => ({ messageId: "sms-1" })),
  sendLoginAlertSms: vi.fn(async () => ({ messageId: "sms-2" })),
  sendWelcomeSms: vi.fn(async () => ({ messageId: "sms-3" })),
};

const { deliverPush, deliverEmail, deliverSms } = loadWithMocks(
  "features/notifications/services/delivery.service.js",
  {
    "core/db/prisma.js": { getPrisma: () => fakePrisma },
    "config/env.config.js": { getConfig: () => ({ mail: { activityUrl: "https://x.test/a" } }) },
    "core/mail/mail.service.js": mail,
    "core/messaging/sms.service.js": smsService,
    "features/notifications/providers/onesignal.provider.js": pushProvider,
  },
);

const verified = new Date();
const addUser = (user) => db.users.set(user.id, { name: "A", status: "ACTIVE", ...user });
const deliveryOf = (notificationId, channel) =>
  [...db.deliveries.values()].find((d) => d.notificationId === notificationId && d.channel === channel);
const last = () => db.notifications.at(-1);

beforeEach(() => {
  resetDb();
  emitted.length = 0;
  queued.push.length = 0;
  queued.email.length = 0;
  queued.sms.length = 0;
  online = false;
  vi.clearAllMocks();
  pushProvider.sendPush.mockResolvedValue({ id: "os-1", recipients: 1, status: "Sent" });
  addUser({ id: "rider", role: "RIDER" });
  addUser({ id: "buyer", role: "BUYER" });
  addUser({ id: "suspended", role: "BUYER", status: "SUSPENDED" });
  addUser({ id: "seller", role: "SELLER" });
  addUser({ id: "both", role: "BUYER", email: "b@x.test", emailVerifiedAt: verified, phone: "+243891234567", phoneVerifiedAt: verified });
  addUser({ id: "phoneOnly", role: "BUYER", email: "p@x.test", emailVerifiedAt: null, phone: "+243891234568", phoneVerifiedAt: verified });
  addUser({ id: "nobody", role: "BUYER" });
});

describe("notify", () => {
  it("writes the inbox row, emits live and queues push for an eligible user", async () => {
    const [result] = await notify({
      event: "delivery.assignment.new",
      userId: "rider",
      data: { deliveryId: "dl1", pickupArea: "Himbi" },
    });
    expect(result.status).toBe("sent");
    expect(deliveryOf(last().id, "IN_APP").status).toBe("SENT");
    expect(emitted[0]).toMatchObject({ event: "notification:new", payload: { unreadCount: 1 } });
    expect(queued.push).toHaveLength(1);
  });

  it("dedupes, and ignores events that do not fit the role or status", async () => {
    const data = { deliveryId: "dl1", pickupArea: "Himbi" };
    await notify({ event: "delivery.assignment.new", userId: "rider", data });
    const [again] = await notify({ event: "delivery.assignment.new", userId: "rider", data });
    expect(again.status).toBe("deduped");
    expect(db.notifications).toHaveLength(1);

    const [wrongRole] = await notify({ event: "delivery.assignment.new", userId: "buyer", data });
    expect(wrongRole.status).toBe("ineligible");

    const order = { orderId: "o1", orderNumber: "#1", shopName: "S" };
    const [blocked] = await notify({ event: "order.placed", userId: "suspended", data: order });
    expect(blocked.status).toBe("ineligible");
    const [security] = await notify({
      event: "security.alert",
      userId: "suspended",
      data: { type: "PASSWORD_CHANGED" },
    });
    expect(security.status).toBe("sent");
  });

  it("never throws for bad input", async () => {
    expect(await notify({ event: "order.placed", userId: "buyer", data: {} })).toEqual([]);
    expect(await notify({ event: "nope", userId: "buyer" })).toEqual([]);
    expect(await notify({ event: "order.delivered", data: { orderId: "o", orderNumber: "#" } })).toEqual([]);
  });

  it("applies preferences, quiet hours and the online rule to push", async () => {
    db.prefs = [{ userId: "buyer", context: "PURCHASE", channel: "PUSH", enabled: false }];
    await notify({ event: "order.accepted", userId: "buyer", data: { orderId: "o1", orderNumber: "#1", shopName: "S" } });
    expect(deliveryOf(last().id, "PUSH").skipReason).toBe("preference_off");
    expect(deliveryOf(last().id, "IN_APP").status).toBe("SENT");

    db.prefs = [];
    db.settings = [{ userId: "buyer", quietHoursEnabled: true, quietHoursStart: 0, quietHoursEnd: 1440, timezone: "Africa/Lubumbashi" }];
    await notify({ event: "order.delivered", userId: "buyer", data: { orderId: "o2", orderNumber: "#2" } });
    expect(deliveryOf(last().id, "PUSH").skipReason).toBe("quiet_hours");

    db.settings = [];
    online = true;
    await notify({ event: "order.delivered", userId: "buyer", data: { orderId: "o3", orderNumber: "#3" } });
    expect(deliveryOf(last().id, "PUSH").skipReason).toBe("user_online");
    await notify({ event: "order.out_for_delivery", userId: "buyer", data: { orderId: "o4", orderNumber: "#4" } });
    expect(deliveryOf(last().id, "PUSH").status).toBe("PENDING");
  });
});

describe("throttling and escalation hooks", () => {
  it("keeps the inbox but holds back outside channels when throttled", async () => {
    throttle.throttleReason.mockResolvedValueOnce("rate_limited");
    await notify({ event: "order.accepted", userId: "both", data: { orderId: "o1", orderNumber: "#1", shopName: "S" } });
    expect(deliveryOf(last().id, "IN_APP").status).toBe("SENT");
    expect(deliveryOf(last().id, "PUSH").skipReason).toBe("rate_limited");
    expect(queued.push).toHaveLength(0);
  });

  it("schedules the escalation of an urgent notification", async () => {
    await notify({ event: "sale.order.new", userId: "seller", data: { orderId: "o1", orderNumber: "#1" } });
    expect(escalation.scheduleEscalation).toHaveBeenCalledTimes(1);
    expect(escalation.scheduleEscalation.mock.calls[0][0].id).toBe(last().id);
  });

  it("does not let a failed escalation schedule break the notification", async () => {
    escalation.scheduleEscalation.mockRejectedValueOnce(new Error("redis down"));
    const [result] = await notify({ event: "sale.order.new", userId: "seller", data: { orderId: "o2", orderNumber: "#2" } });
    expect(result.status).toBe("sent");
  });
});

describe("email and SMS channels", () => {
  const alert = { type: "PASSWORD_CHANGED", date: "2026-10-26T10:30:00.000Z" };

  it("emails when the email is verified and does not send the SMS fallback", async () => {
    await notify({ event: "security.alert", userId: "both", data: alert });
    expect(deliveryOf(last().id, "EMAIL").status).toBe("PENDING");
    expect(deliveryOf(last().id, "SMS").skipReason).toBe("email_preferred");
    expect(queued.email).toHaveLength(1);
    expect(queued.sms).toHaveLength(0);
  });

  it("falls back to SMS when only the phone is verified", async () => {
    await notify({ event: "security.alert", userId: "phoneOnly", data: alert });
    expect(deliveryOf(last().id, "EMAIL").skipReason).toBe("no_email");
    expect(deliveryOf(last().id, "SMS").status).toBe("PENDING");
    expect(queued.sms).toHaveLength(1);
  });

  it("sends nothing outside the inbox when no contact is verified", async () => {
    await notify({ event: "security.alert", userId: "nobody", data: alert });
    expect(deliveryOf(last().id, "EMAIL").skipReason).toBe("no_email");
    expect(deliveryOf(last().id, "SMS").skipReason).toBe("no_phone");
    expect(queued.email).toHaveLength(0);
    expect(queued.sms).toHaveLength(0);
  });

  it("sends recovery alerts to both email and SMS", async () => {
    await notify({ event: "security.recovery", userId: "both", data: { type: "RECOVERY_REQUESTED" } });
    expect(queued.email).toHaveLength(1);
    expect(queued.sms).toHaveLength(1);
  });

  it("does not send an SMS when the user turned email off for a non-mandatory event", async () => {
    db.prefs = [{ userId: "phoneOnly", context: "ANNOUNCEMENT", channel: "EMAIL", enabled: false }];
    db.users.get("phoneOnly").emailVerifiedAt = verified;
    await notify({ event: "account.welcome", userId: "phoneOnly", data: { role: "BUYER" } });
    expect(deliveryOf(last().id, "EMAIL").skipReason).toBe("preference_off");
    expect(deliveryOf(last().id, "SMS").skipReason).toBe("email_preferred");
  });

  it("welcomes a user only once", async () => {
    await notify({ event: "account.welcome", userId: "both", data: { role: "SELLER" } });
    const [again] = await notify({ event: "account.welcome", userId: "both", data: { role: "SELLER" } });
    expect(again.status).toBe("deduped");
    expect(last().body).toContain("boutique");
  });
});

describe("delivery jobs", () => {
  const job = (attemptsMade = 0) => ({ attemptsMade, opts: { attempts: 3 } });
  const alert = { type: "PASSWORD_CHANGED", date: "2026-10-26T10:30:00.000Z" };

  async function queueFor(userId, channel, event = "security.alert", data = alert) {
    await notify({ event, userId, data });
    return deliveryOf(last().id, channel);
  }

  it("sends the email through the right template and records the message id", async () => {
    const delivery = await queueFor("both", "EMAIL");
    await deliverEmail({ deliveryId: delivery.id }, job());
    expect(mail.sendSecurityAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "b@x.test", type: "PASSWORD_CHANGED", activityUrl: "https://x.test/a" }),
    );
    expect(delivery).toMatchObject({ status: "SENT", provider: "smtp", providerRef: "mail-1" });
  });

  it("sends the SMS through the right template", async () => {
    const delivery = await queueFor("phoneOnly", "SMS");
    await deliverSms({ deliveryId: delivery.id }, job());
    expect(smsService.sendSecurityAlertSms).toHaveBeenCalledWith({ to: "+243891234568", type: "PASSWORD_CHANGED" });
    expect(delivery).toMatchObject({ status: "SENT", providerRef: "sms-1" });
  });

  it("sends to the address chosen when the notification was raised, even if the contact changes", async () => {
    const delivery = await queueFor("both", "EMAIL");
    expect(delivery.target).toBe("b@x.test");
    db.users.get("both").email = "changed@x.test";
    await deliverEmail({ deliveryId: delivery.id }, job());
    expect(mail.sendSecurityAlertEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "b@x.test" }));
  });

  it("can warn the previous contacts of an account whose contacts were replaced", async () => {
    await notify({
      event: "security.recovery",
      userId: "both",
      data: { type: "RECOVERY_COMPLETED" },
      contacts: { email: "old@x.test", phone: null },
    });
    expect(deliveryOf(last().id, "EMAIL")).toMatchObject({ status: "PENDING", target: "old@x.test" });
    expect(deliveryOf(last().id, "SMS").skipReason).toBe("no_phone");

    await deliverEmail({ deliveryId: deliveryOf(last().id, "EMAIL").id }, job());
    expect(mail.sendSecurityAlertEmail).toHaveBeenCalledWith(expect.objectContaining({ to: "old@x.test" }));
  });

  it("is idempotent once sent", async () => {
    const delivery = await queueFor("both", "EMAIL");
    await deliverEmail({ deliveryId: delivery.id }, job());
    await deliverEmail({ deliveryId: delivery.id }, job());
    expect(mail.sendSecurityAlertEmail).toHaveBeenCalledTimes(1);
  });

  it("keeps a failing delivery pending until the last attempt, then fails it", async () => {
    const delivery = await queueFor("both", "EMAIL");
    mail.sendSecurityAlertEmail.mockRejectedValue(new Error("smtp down"));
    await expect(deliverEmail({ deliveryId: delivery.id }, job(0))).rejects.toThrow("smtp down");
    expect(delivery).toMatchObject({ status: "PENDING", attempts: 1 });
    await expect(deliverEmail({ deliveryId: delivery.id }, job(2))).rejects.toThrow();
    expect(delivery.status).toBe("FAILED");
  });

  it("fails a permanent provider rejection immediately", async () => {
    const delivery = await queueFor("phoneOnly", "SMS");
    smsService.sendSecurityAlertSms.mockRejectedValueOnce(AppError.badRequest("bad", null, "INVALID_PHONE"));
    await expect(deliverSms({ deliveryId: delivery.id }, job(0))).rejects.toThrow();
    expect(delivery.status).toBe("FAILED");
  });

  it("targets only devices whose session is alive, and falls back to the user id for new users", async () => {
    const live = { id: "s-live", expiresAt: new Date(Date.now() + 1e6), revokedAt: null };
    const dead = { id: "s-dead", expiresAt: new Date(Date.now() + 1e6), revokedAt: new Date() };
    db.sessions = [live, dead];
    db.devices = [
      { userId: "buyer", subscriptionId: "sub-live", sessionId: "s-live" },
      { userId: "buyer", subscriptionId: "sub-dead", sessionId: "s-dead" },
    ];

    const delivery = await queueFor("buyer", "PUSH", "order.accepted", { orderId: "t1", orderNumber: "#1", shopName: "S" });
    await deliverPush({ deliveryId: delivery.id }, job());
    expect(pushProvider.sendPush).toHaveBeenLastCalledWith(
      expect.objectContaining({ subscriptionIds: ["sub-live"] }),
    );

    db.devices = [];
    const fresh = await queueFor("buyer", "PUSH", "order.accepted", { orderId: "t2", orderNumber: "#2", shopName: "S" });
    await deliverPush({ deliveryId: fresh.id }, job());
    expect(pushProvider.sendPush).toHaveBeenLastCalledWith(expect.objectContaining({ userIds: ["buyer"] }));
  });

  it("skips push when every registered device was signed out", async () => {
    db.sessions = [{ id: "s-dead", expiresAt: new Date(Date.now() + 1e6), revokedAt: new Date() }];
    db.devices = [{ userId: "buyer", subscriptionId: "sub-dead", sessionId: "s-dead" }];
    const delivery = await queueFor("buyer", "PUSH", "order.accepted", { orderId: "t3", orderNumber: "#3", shopName: "S" });
    await deliverPush({ deliveryId: delivery.id }, job());
    expect(delivery).toMatchObject({ status: "SKIPPED", skipReason: "no_active_device" });
    expect(pushProvider.sendPush).not.toHaveBeenCalled();
  });

  it("handles push outcomes", async () => {
    const delivery = await queueFor("buyer", "PUSH", "order.accepted", { orderId: "o9", orderNumber: "#9", shopName: "S" });
    await deliverPush({ deliveryId: delivery.id }, job());
    expect(delivery).toMatchObject({ status: "SENT", providerRef: "os-1" });

    const none = await queueFor("buyer", "PUSH", "order.accepted", { orderId: "o10", orderNumber: "#10", shopName: "S" });
    pushProvider.sendPush.mockResolvedValueOnce({ id: null, recipients: 0, status: "NoSubscribers" });
    await deliverPush({ deliveryId: none.id }, job());
    expect(none).toMatchObject({ status: "SKIPPED", skipReason: "no_device" });

    const read = await queueFor("buyer", "PUSH", "order.accepted", { orderId: "o11", orderNumber: "#11", shopName: "S" });
    last().readAt = new Date();
    await deliverPush({ deliveryId: read.id }, job());
    expect(read.skipReason).toBe("already_read");
  });
});
