import { describe, expect, it } from "vitest";
import { ApiError, NetworkError } from "swiftgoma-mp-auth";
import { createNotifications } from "../src/index";
import type { Notifications } from "../src/index";
import { combineTransports, createFakeNotificationsServer } from "../src/testing/index";
import type { FakeNotificationsServerOptions } from "../src/testing/index";
import { authOver } from "./helpers";

function setup(options?: FakeNotificationsServerOptions) {
  const server = createFakeNotificationsServer(options);
  const notifications: Notifications = createNotifications({
    auth: authOver(server.transport).auth,
  });
  return { server, notifications };
}

describe("fake notifications server: inbox", () => {
  it("lists the newest first, page by page", async () => {
    const { server, notifications } = setup();
    for (const title of ["one", "two", "three"]) server.add({ title });

    const first = await notifications.inbox.list({ limit: 2 });
    expect(first.items.map((item) => item.title)).toEqual(["three", "two"]);
    expect(first.nextCursor).not.toBeNull();

    const second = await notifications.inbox.list({ limit: 2, cursor: first.nextCursor ?? "" });
    expect(second.items.map((item) => item.title)).toEqual(["one"]);
    expect(second.nextCursor).toBeNull();
  });

  it("filters by context and by unread", async () => {
    const { server, notifications } = setup();
    server.add({ context: "SALE" });
    server.add({ context: "PURCHASE", read: true });
    server.add({ context: "PURCHASE" });

    expect((await notifications.inbox.list({ context: "PURCHASE" })).items).toHaveLength(2);
    expect((await notifications.inbox.list({ unread: true })).items).toHaveLength(2);
  });

  it("takes the context, priority and read state of a known event", async () => {
    const { server } = setup();
    const item = server.add({ type: "sale.order.new" });
    expect(item).toMatchObject({ context: "SALE", priority: "CRITICAL", readAt: null });
  });

  it("counts the unread ones per context", async () => {
    const { server, notifications } = setup();
    server.add({ context: "SALE" });
    server.add({ context: "SALE" });
    server.add({ context: "PURCHASE", read: true });

    expect(await notifications.inbox.unreadCount()).toEqual({
      unreadCount: 2,
      byContext: { SALE: 2 },
    });
  });

  it("marks one read, acknowledges, marks everything read and deletes", async () => {
    const { server, notifications } = setup();
    const a = server.add({ context: "SALE" });
    const b = server.add({ context: "SALE" });
    const c = server.add({ context: "PURCHASE" });
    server.add({ context: "PURCHASE" });

    expect((await notifications.inbox.markRead(a.id)).unreadCount).toBe(3);
    expect((await notifications.inbox.acknowledge(b.id)).unreadCount).toBe(2);
    expect(await notifications.inbox.markAllRead({ context: "PURCHASE" })).toEqual({
      updated: 2,
      unreadCount: 0,
    });
    expect((await notifications.inbox.remove(c.id)).unreadCount).toBe(0);
    expect((await notifications.inbox.list()).items).toHaveLength(3);
  });

  it("records an open only the first time", async () => {
    const { server, notifications } = setup();
    const { id } = server.add();
    expect((await notifications.inbox.markOpened(id)).recorded).toBe(true);
    expect((await notifications.inbox.markOpened(id)).recorded).toBe(false);
  });

  it("answers like the server for an unknown notification or cursor", async () => {
    const { notifications } = setup();
    const missing = await notifications.inbox.markRead("nope").catch((error: unknown) => error);
    expect(missing).toBeInstanceOf(ApiError);
    expect(missing).toMatchObject({ code: "NOTIFICATION_NOT_FOUND", status: 404 });

    await expect(notifications.inbox.list({ cursor: "-1" })).rejects.toMatchObject({
      code: "INVALID_CURSOR",
    });
  });
});

describe("fake notifications server: the rest", () => {
  it("keeps the registered devices", async () => {
    const { server, notifications } = setup();
    const input = {
      subscriptionId: "sub-12345678",
      deviceId: "device-12345678",
      platform: "ANDROID",
    } as const;

    await notifications.devices.register(input);
    expect(server.devices).toEqual([input]);
    expect(await notifications.devices.remove("sub-12345678")).toEqual({ removed: 1 });
    expect(server.devices).toEqual([]);
  });

  it("lists only the events of the role", async () => {
    const seller = await setup({ role: "SELLER" }).notifications.catalog.list();
    const buyer = await setup().notifications.catalog.list();

    expect(seller.map((entry) => entry.type)).toContain("sale.order.new");
    expect(buyer.map((entry) => entry.type)).not.toContain("sale.order.new");
    expect(buyer.find((entry) => entry.type === "security.alert")?.channels).toEqual([
      "IN_APP",
      "PUSH",
      "EMAIL",
      "SMS",
    ]);
  });

  it("changes a preference but refuses a locked one", async () => {
    const { server, notifications } = setup();
    server.preferences.categories = [
      {
        context: "SALE",
        label: "Mes ventes",
        locked: false,
        hasMandatory: false,
        channels: [{ channel: "SMS", locked: false, enabled: true }],
      },
      {
        context: "SECURITY",
        label: "Sécurité",
        locked: true,
        hasMandatory: true,
        channels: [{ channel: "SMS", locked: true, enabled: true }],
      },
    ];

    const next = await notifications.preferences.update([
      { context: "SALE", channel: "SMS", enabled: false },
    ]);
    expect(next.categories[0]?.channels[0]?.enabled).toBe(false);
    await expect(
      notifications.preferences.update([{ context: "SECURITY", channel: "SMS", enabled: false }]),
    ).rejects.toMatchObject({ code: "PREFERENCE_LOCKED", status: 403 });
    await expect(
      notifications.preferences.update([{ context: "SALE", channel: "EMAIL", enabled: false }]),
    ).rejects.toMatchObject({ code: "PREFERENCE_UNAVAILABLE" });
  });

  it("merges settings", async () => {
    const { notifications } = setup();
    const settings = await notifications.preferences.updateSettings({ marketingEmailOptIn: true });
    expect(settings).toMatchObject({ marketingEmailOptIn: true, timezone: "Africa/Lubumbashi" });
    expect((await notifications.preferences.get()).settings.marketingEmailOptIn).toBe(true);
  });

  it("fails like a lost connection while offline", async () => {
    const { server, notifications } = setup();
    server.setOffline(true);
    await expect(notifications.inbox.list()).rejects.toBeInstanceOf(NetworkError);
    server.setOffline(false);
    await expect(notifications.inbox.list()).resolves.toMatchObject({ items: [] });
  });

  it("remembers the requests it received", async () => {
    const { server, notifications } = setup();
    await notifications.inbox.unreadCount();
    expect(server.requests).toEqual([
      { method: "GET", path: "/notifications/unread-count", body: undefined },
    ]);
  });
});

describe("combineTransports", () => {
  it("sends each request to the server that owns its prefix", async () => {
    const notificationsServer = createFakeNotificationsServer();
    const other = createFakeNotificationsServer();
    other.add({ title: "elsewhere" });
    const { auth } = authOver(
      combineTransports({
        "/notifications": notificationsServer.transport,
        "/other": other.transport,
      }),
    );

    expect((await createNotifications({ auth }).inbox.list()).items).toEqual([]);
  });

  it("fails like a lost connection for a path nobody owns", async () => {
    const { auth } = authOver(combineTransports({}));
    const error = await auth.api.get("/anything").catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(NetworkError);
  });
});
