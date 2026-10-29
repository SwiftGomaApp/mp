import { beforeEach, describe, expect, it, vi } from "vitest";
import { createRequire } from "node:module";
import { loadWithMocks } from "../helpers/mockModules.mjs";

const require = createRequire(import.meta.url);
const jwt = require("jsonwebtoken");

class FakeRedis {
  constructor() {
    this.counts = new Map();
    this.down = false;
  }
  async incr(key) {
    if (this.down) throw new Error("redis down");
    const next = (this.counts.get(key) ?? 0) + 1;
    this.counts.set(key, next);
    return next;
  }
  async expire() {
    return 1;
  }
}

const redis = new FakeRedis();
beforeEach(() => {
  redis.counts.clear();
  redis.down = false;
});

describe("throttling", () => {
  const { throttleReason, FLOOD_LIMIT_PER_HOUR } = loadWithMocks(
    "features/notifications/services/throttle.service.js",
    { "core/cache/redis.js": { getRedis: () => redis } },
  );

  const normal = { key: "chat.message", priority: "NORMAL", mandatory: false };

  it("never holds back mandatory events", async () => {
    const event = { ...normal, mandatory: true, throttle: { max: 0, windowSeconds: 60 } };
    expect(await throttleReason("u1", event)).toBeNull();
  });

  it("limits an event that declares a throttle", async () => {
    const event = { ...normal, priority: "HIGH", throttle: { max: 2, windowSeconds: 60 } };
    expect(await throttleReason("u1", event)).toBeNull();
    expect(await throttleReason("u1", event)).toBeNull();
    expect(await throttleReason("u1", event)).toBe("throttled");
    expect(await throttleReason("u2", event)).toBeNull();
  });

  it("caps ordinary notifications per hour but lets urgent ones through", async () => {
    for (let i = 0; i < FLOOD_LIMIT_PER_HOUR; i += 1) await throttleReason("u1", normal);
    expect(await throttleReason("u1", normal)).toBe("rate_limited");
    expect(await throttleReason("u1", { ...normal, priority: "CRITICAL" })).toBeNull();
  });

  it("fails open when Redis is down", async () => {
    redis.down = true;
    expect(await throttleReason("u1", normal)).toBeNull();
  });
});

describe("escalation", () => {
  const db = { notification: null, delivery: null, created: [], prefs: [], settings: [] };
  const queueEscalation = vi.fn(async () => undefined);
  const queueSmsDelivery = vi.fn(async () => undefined);
  const consumeAlertSmsBudget = vi.fn(async () => true);

  const prisma = {
    notification: { findUnique: async () => db.notification },
    notificationDelivery: {
      findUnique: async () => db.delivery,
      create: async ({ data }) => {
        const row = { id: "delivery-1", ...data };
        db.created.push(row);
        return row;
      },
    },
    notificationPreference: { findMany: async () => db.prefs },
    notificationSettings: { findMany: async () => db.settings },
  };

  const { scheduleEscalation, runEscalation } = loadWithMocks(
    "features/notifications/services/escalation.service.js",
    {
      "core/db/prisma.js": { getPrisma: () => prisma },
      "core/queue/notifications.js": { queueEscalation, queueSmsDelivery },
      "core/messaging/smsBudget.js": { consumeAlertSmsBudget },
    },
  );
  const { EVENTS } = require("../../src/features/notifications/config/events.config");

  const unread = (overrides = {}) => ({
    id: "n1",
    userId: "seller1",
    type: "sale.order.new",
    readAt: null,
    acknowledgedAt: null,
    user: { status: "ACTIVE", phone: "+243891234567", phoneVerifiedAt: new Date() },
    ...overrides,
  });

  beforeEach(() => {
    db.notification = unread();
    db.delivery = null;
    db.created = [];
    db.prefs = [];
    db.settings = [];
    vi.clearAllMocks();
    consumeAlertSmsBudget.mockResolvedValue(true);
  });

  it("schedules a delayed job only for events that escalate", async () => {
    await scheduleEscalation({ id: "n1" }, EVENTS["sale.order.new"]);
    expect(queueEscalation).toHaveBeenCalledWith({ notificationId: "n1" }, 5 * 60 * 1000);

    await scheduleEscalation({ id: "n2" }, EVENTS["delivery.assignment.new"]);
    expect(queueEscalation).toHaveBeenLastCalledWith({ notificationId: "n2" }, 2 * 60 * 1000);

    queueEscalation.mockClear();
    await scheduleEscalation({ id: "n3" }, EVENTS["order.placed"]);
    expect(queueEscalation).not.toHaveBeenCalled();
  });

  it("sends the SMS when nobody has read or acknowledged the notification", async () => {
    const result = await runEscalation({ notificationId: "n1" });
    expect(result.status).toBe("escalated");
    expect(db.created[0]).toMatchObject({ channel: "SMS", status: "PENDING" });
    expect(queueSmsDelivery).toHaveBeenCalledWith({ deliveryId: "delivery-1" });
  });

  it("stops when the person already read or acknowledged it", async () => {
    db.notification = unread({ readAt: new Date() });
    expect((await runEscalation({ notificationId: "n1" })).status).toBe("answered");
    db.notification = unread({ acknowledgedAt: new Date() });
    expect((await runEscalation({ notificationId: "n1" })).status).toBe("answered");
    expect(queueSmsDelivery).not.toHaveBeenCalled();
  });

  it("is idempotent and tolerates a deleted notification", async () => {
    db.delivery = { id: "existing" };
    expect((await runEscalation({ notificationId: "n1" })).status).toBe("already_escalated");
    db.notification = null;
    expect((await runEscalation({ notificationId: "gone" })).status).toBe("gone");
    expect(db.created).toHaveLength(0);
  });

  it.each([
    ["no verified phone", { user: { status: "ACTIVE", phone: null, phoneVerifiedAt: null } }, "no_phone"],
    ["an inactive account", { user: { status: "SUSPENDED", phone: "+243891234567", phoneVerifiedAt: new Date() } }, "inactive"],
  ])("records a skipped SMS for %s", async (_name, overrides, reason) => {
    db.notification = unread(overrides);
    const result = await runEscalation({ notificationId: "n1" });
    expect(result).toMatchObject({ status: "skipped", reason });
    expect(db.created[0]).toMatchObject({ status: "SKIPPED", skipReason: reason });
    expect(queueSmsDelivery).not.toHaveBeenCalled();
  });

  it("respects the daily SMS budget and the user's SMS preference", async () => {
    consumeAlertSmsBudget.mockResolvedValue(false);
    expect(await runEscalation({ notificationId: "n1" })).toMatchObject({ reason: "sms_budget" });

    consumeAlertSmsBudget.mockResolvedValue(true);
    db.created = [];
    db.prefs = [{ userId: "seller1", context: "SALE", channel: "SMS", enabled: false }];
    expect(await runEscalation({ notificationId: "n1" })).toMatchObject({ reason: "preference_off" });
  });

  it("ignores a mandatory rider assignment's SMS preference", async () => {
    db.notification = unread({ type: "delivery.assignment.new", userId: "rider1" });
    db.prefs = [{ userId: "rider1", context: "DELIVERY", channel: "SMS", enabled: false }];
    expect((await runEscalation({ notificationId: "n1" })).status).toBe("escalated");
  });
});

describe("SMS delivery report webhook", () => {
  const updateMany = vi.fn(async () => ({ count: 1 }));
  const config = { sms: { webhookSecret: "s3cret-value" } };

  const { recordSmsReport, classify } = loadWithMocks(
    "features/notifications/services/webhook.service.js",
    { "core/db/prisma.js": { getPrisma: () => ({ notificationDelivery: { updateMany } }) } },
  );
  const controller = loadWithMocks("features/notifications/controllers/webhook.controller.js", {
    "config/env.config.js": { getConfig: () => config },
    "features/notifications/services/webhook.service.js": { recordSmsReport },
  });

  beforeEach(() => updateMany.mockClear());

  it("maps provider statuses", () => {
    expect(classify("Success")).toBe("DELIVERED");
    expect(classify("delivered")).toBe("DELIVERED");
    expect(classify("Failed")).toBe("FAILED");
    expect(classify("Rejected")).toBe("FAILED");
    expect(classify("Sent")).toBeNull();
    expect(classify(undefined)).toBeNull();
  });

  it("marks only sent SMS deliveries, and keeps the failure reason", async () => {
    await recordSmsReport({ id: "ATXid_1", status: "Failed", failureReason: "InsufficientFunds" });
    const { where, data } = updateMany.mock.calls[0][0];
    expect(where).toEqual({ channel: "SMS", providerRef: "ATXid_1", status: { in: ["SENT", "PENDING"] } });
    expect(data).toMatchObject({ status: "FAILED", error: "InsufficientFunds" });

    await recordSmsReport({ id: "ATXid_2", status: "Success" });
    expect(updateMany.mock.calls[1][0].data.status).toBe("DELIVERED");
  });

  it("ignores intermediate statuses", async () => {
    expect(await recordSmsReport({ id: "x", status: "Buffered" })).toEqual({ updated: 0 });
    expect(updateMany).not.toHaveBeenCalled();
  });

  const call = async (query, body = { id: "x", status: "Success" }) => {
    const res = { status: vi.fn().mockReturnThis(), send: vi.fn() };
    const next = vi.fn();
    await controller.smsReport({ query, body }, res, next);
    return { res, next };
  };

  it("requires the secret key in the callback URL", async () => {
    const wrong = await call({ key: "nope" });
    expect(wrong.next.mock.calls[0][0].status).toBe(401);
    const missing = await call({});
    expect(missing.next.mock.calls[0][0].status).toBe(401);
    expect(updateMany).not.toHaveBeenCalled();

    const ok = await call({ key: "s3cret-value" });
    expect(ok.res.status).toHaveBeenCalledWith(200);
    expect(updateMany).toHaveBeenCalledTimes(1);
  });

  it("stays disabled until a secret is configured", async () => {
    config.sms.webhookSecret = "";
    const { next } = await call({ key: "" });
    expect(next.mock.calls[0][0].status).toBe(503);
    config.sms.webhookSecret = "s3cret-value";
  });
});

describe("notification cleanup", () => {
  it("removes expired notifications and stale devices", async () => {
    const notificationDelete = vi.fn(async () => ({ count: 7 }));
    const deviceDelete = vi.fn(async () => ({ count: 2 }));
    const { cleanNotifications } = loadWithMocks("features/notifications/services/cleanup.service.js", {
      "core/db/prisma.js": {
        getPrisma: () => ({
          notification: { deleteMany: notificationDelete },
          deviceRegistration: { deleteMany: deviceDelete },
        }),
      },
    });

    expect(await cleanNotifications()).toEqual({ notifications: 7, devices: 2 });
    expect(notificationDelete.mock.calls[0][0].where.expiresAt.lt).toBeInstanceOf(Date);
    const { OR } = deviceDelete.mock.calls[0][0].where;
    expect(OR).toHaveLength(2);
    expect(OR[0].disabledAt.lt).toBeInstanceOf(Date);
    expect(OR[1].lastSeenAt.lt).toBeInstanceOf(Date);
  });
});

describe("realtime handshake limit", () => {
  const config = { trustProxy: false };
  const { allowHandshake, clientIp, MAX_HANDSHAKES_PER_WINDOW } = loadWithMocks(
    "core/realtime/handshakeLimit.js",
    {
      "config/env.config.js": { getConfig: () => config },
      "core/cache/redis.js": { getRedis: () => redis },
    },
  );

  const request = (url = "/socket.io/?EIO=4&transport=websocket", headers = {}, ip = "10.0.0.1") => ({
    url,
    headers,
    socket: { remoteAddress: ip },
  });

  beforeEach(() => {
    config.trustProxy = false;
  });

  it("blocks an address that opens too many new connections", async () => {
    for (let i = 0; i < MAX_HANDSHAKES_PER_WINDOW; i += 1) {
      expect(await allowHandshake(request())).toBe(true);
    }
    expect(await allowHandshake(request())).toBe(false);
    expect(await allowHandshake(request(undefined, {}, "10.0.0.2"))).toBe(true);
  });

  it("does not count follow-up requests of an existing connection", async () => {
    for (let i = 0; i < MAX_HANDSHAKES_PER_WINDOW + 20; i += 1) {
      expect(await allowHandshake(request("/socket.io/?EIO=4&transport=polling&sid=abc"))).toBe(true);
    }
  });

  it("uses the proxy-reported address only when proxies are trusted", () => {
    const forwarded = { "x-forwarded-for": "6.6.6.6, 203.0.113.9" };
    expect(clientIp(request(undefined, forwarded))).toBe("10.0.0.1");
    config.trustProxy = 1;
    expect(clientIp(request(undefined, forwarded))).toBe("203.0.113.9");
  });

  it("fails open when Redis is down", async () => {
    redis.down = true;
    expect(await allowHandshake(request())).toBe(true);
  });
});

describe("realtime handshake authentication", () => {
  const user = { status: "ACTIVE", totp: null };
  let dbError = null;
  const claims = { userId: "u1", role: "BUYER", sessionId: "s1" };
  const token = jwt.sign({ sub: "u1" }, "irrelevant", { expiresIn: 600 });

  const { authenticateSocket } = loadWithMocks("core/realtime/socketAuth.js", {
    "config/env.config.js": { getConfig: () => ({ corsOrigins: ["https://app.test"] }) },
    "core/auth/tokens.js": { verifyAccessToken: () => claims },
    "core/auth/revocation.js": { isSessionRevoked: async () => false },
    "core/db/prisma.js": {
      getPrisma: () => ({
        user: {
          findUnique: async () => {
            if (dbError) throw dbError;
            return user.status === "MISSING" ? null : user;
          },
        },
      }),
    },
    "features/auth/config/auth.config.js": {
      authConfig: { twoFactorRequiredRoles: ["SUPPORT", "ADMIN"] },
    },
  });

  const connect = async (handshake) => {
    const socket = { handshake, data: {} };
    const next = vi.fn();
    await authenticateSocket(socket, next);
    return { socket, error: next.mock.calls[0]?.[0] };
  };
  const bearer = { auth: { token }, headers: {} };

  beforeEach(() => {
    Object.assign(user, { status: "ACTIVE", totp: null });
    Object.assign(claims, { role: "BUYER" });
    dbError = null;
  });

  it("lets an active account in", async () => {
    const { socket, error } = await connect(bearer);
    expect(error).toBeUndefined();
    expect(socket.data.auth.userId).toBe("u1");
  });

  it.each(["SUSPENDED", "BANNED", "DELETED", "MISSING"])("refuses a %s account", async (status) => {
    user.status = status;
    expect((await connect(bearer)).error.data.code).toBe("ACCOUNT_BLOCKED");
  });

  it("refuses staff who have not finished two-factor setup", async () => {
    claims.role = "ADMIN";
    expect((await connect(bearer)).error.data.code).toBe("TWO_FACTOR_REQUIRED");
    user.totp = { confirmedAt: new Date() };
    expect((await connect(bearer)).error).toBeUndefined();
  });

  it("reports infrastructure failures as retryable", async () => {
    dbError = new Error("db down");
    expect((await connect(bearer)).error.data.code).toBe("UNAVAILABLE");
  });

  it("requires a trusted Origin when authenticating with the cookie", async () => {
    const cookie = `__Host-swg_access=${token}`;
    expect((await connect({ headers: { cookie } })).error.data.code).toBe("ORIGIN_NOT_ALLOWED");
    expect(
      (await connect({ headers: { cookie, origin: "https://evil.test" } })).error.data.code,
    ).toBe("ORIGIN_NOT_ALLOWED");
    expect((await connect({ headers: { cookie, origin: "https://app.test" } })).error).toBeUndefined();
  });
});

describe("OneSignal request", () => {
  const push = { appId: "app", apiKey: "key", baseUrl: "https://os.test", dryRun: false, timeoutMs: 1000 };
  const { sendPush } = loadWithMocks("features/notifications/providers/onesignal.provider.js", {
    "config/env.config.js": { getConfig: () => ({ push }) },
  });

  const respond = (body = { id: "os-1", recipients: 1 }, status = 200) =>
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }),
    );
  const sentBody = () => JSON.parse(globalThis.fetch.mock.calls.at(-1)[1].body);

  beforeEach(() => vi.restoreAllMocks());

  it("targets specific subscriptions when given, otherwise the user ids", async () => {
    respond();
    await sendPush({ subscriptionIds: ["sub-1", "sub-2"], title: "T", body: "B" });
    expect(sentBody()).toMatchObject({ include_subscription_ids: ["sub-1", "sub-2"] });
    expect(sentBody().include_aliases).toBeUndefined();

    await sendPush({ userIds: ["u1"], title: "T", body: "B", idempotencyKey: "k", priority: 10, ttl: 60 });
    expect(sentBody()).toMatchObject({
      include_aliases: { external_id: ["u1"] },
      idempotency_key: "k",
      priority: 10,
      ttl: 60,
    });
    expect(sentBody().include_subscription_ids).toBeUndefined();
  });

  it("separates retryable failures from permanent ones and empty audiences", async () => {
    respond({}, 503);
    await expect(sendPush({ userIds: ["u1"], title: "T", body: "B" })).rejects.toMatchObject({ status: 503 });
    respond({ errors: ["bad"] }, 400);
    await expect(sendPush({ userIds: ["u1"], title: "T", body: "B" })).rejects.toMatchObject({ status: 400 });
    respond({});
    expect(await sendPush({ userIds: ["u1"], title: "T", body: "B" })).toMatchObject({ status: "NoSubscribers" });
    expect(await sendPush({ userIds: [], title: "T", body: "B" })).toMatchObject({ status: "NoTargets" });
  });
});
