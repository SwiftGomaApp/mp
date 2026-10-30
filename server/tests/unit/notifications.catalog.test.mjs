import { beforeEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { loadWithMocks } from "../helpers/mockModules.mjs";

const require = createRequire(import.meta.url);
const { EVENTS } = require("../../src/features/notifications/config/events.config");
const { listCatalog } = require("../../src/features/notifications/services/catalog.service");

describe("event catalog", () => {
  it("lists every event a role can receive and hides the other roles' events", () => {
    const types = (role) => listCatalog(role).events.map((e) => e.type);

    expect(types("SELLER")).toContain("sale.order.new");
    expect(types("SELLER")).not.toContain("delivery.assignment.new");
    expect(types("RIDER")).toContain("delivery.assignment.new");
    expect(types("RIDER")).not.toContain("sale.order.new");
    expect(types("SELLER")).toContain("security.alert");
  });

  it("exposes only public fields", () => {
    const [entry] = listCatalog("ADMIN").events;
    expect(Object.keys(entry).sort()).toEqual(
      ["channels", "context", "escalation", "mandatory", "priority", "type"].sort(),
    );
  });

  it("covers every event for the roles that have one", () => {
    const covered = new Set(
      ["BUYER", "SELLER", "RIDER", "SUPPORT", "ADMIN"].flatMap((role) =>
        listCatalog(role).events.map((e) => e.type),
      ),
    );
    expect([...covered].sort()).toEqual(Object.keys(EVENTS).sort());
  });
});

describe("push opened", () => {
  const notifications = [{ id: "n1", userId: "u1" }];
  let deliveries;

  const fakePrisma = {
    notification: {
      findFirst: async ({ where }) =>
        notifications.find((n) => n.id === where.id && n.userId === where.userId) ?? null,
    },
    notificationDelivery: {
      updateMany: async ({ where, data }) => {
        const rows = deliveries.filter(
          (d) =>
            d.notificationId === where.notificationId &&
            d.channel === where.channel &&
            where.status.in.includes(d.status) &&
            d.openedAt === null,
        );
        rows.forEach((row) => Object.assign(row, data));
        return { count: rows.length };
      },
    },
  };

  const { markOpened } = loadWithMocks("features/notifications/services/inbox.service.js", {
    "core/db/prisma.js": { getPrisma: () => fakePrisma },
    "core/realtime/emit.js": { emitToUser: () => {} },
  });

  beforeEach(() => {
    deliveries = [
      { notificationId: "n1", channel: "PUSH", status: "SENT", openedAt: null },
      { notificationId: "n1", channel: "EMAIL", status: "SENT", openedAt: null },
    ];
  });

  it("records the first open of a sent push, and only once", async () => {
    expect(await markOpened("u1", "n1")).toEqual({ id: "n1", recorded: true });
    expect(deliveries[0].openedAt).toBeInstanceOf(Date);
    expect(deliveries[1].openedAt).toBeNull();
    expect(await markOpened("u1", "n1")).toEqual({ id: "n1", recorded: false });
  });

  it("records nothing when no push was sent", async () => {
    deliveries[0].status = "SKIPPED";
    expect(await markOpened("u1", "n1")).toEqual({ id: "n1", recorded: false });
  });

  it("refuses somebody else's notification", async () => {
    await expect(markOpened("u2", "n1")).rejects.toMatchObject({ code: "NOTIFICATION_NOT_FOUND" });
  });
});
