import { describe, expect, it } from "vitest";
import { ApiError } from "swiftgoma-mp-auth";
import { createNotifications } from "../src/index";
import { fail, fakeAuth, ok } from "./helpers";

const item = {
  id: "n1",
  type: "order.placed",
  context: "PURCHASE",
  priority: "NORMAL",
  title: "Commande envoyée",
  body: "…",
  data: { orderId: "o1" },
  readAt: null,
  acknowledgedAt: null,
  createdAt: "2026-10-30T10:00:00.000Z",
};

describe("inbox", () => {
  it("reads a page and sends only the filters that were given", async () => {
    const { auth, calls } = fakeAuth(() =>
      ok({ items: [item], nextCursor: "abc", unreadCount: 3 }),
    );
    const page = await createNotifications({ auth }).inbox.list({ limit: 10, unread: true });

    expect(page).toEqual({ items: [item], nextCursor: "abc", unreadCount: 3 });
    expect(calls[0]).toMatchObject({ method: "get", url: "/notifications" });
    expect(calls[0]?.params).toEqual({ limit: 10, unread: true });
  });

  it("returns a null cursor on the last page", async () => {
    const { auth } = fakeAuth(() => ok({ items: [], nextCursor: null, unreadCount: 0 }));
    expect((await createNotifications({ auth }).inbox.list()).nextCursor).toBeNull();
  });

  it("refuses a page size the server would refuse", async () => {
    const { auth, calls } = fakeAuth(() => ok());
    const { inbox } = createNotifications({ auth });
    await expect(inbox.list({ limit: 0 })).rejects.toThrow(TypeError);
    await expect(inbox.list({ limit: 51 })).rejects.toThrow(TypeError);
    expect(calls).toHaveLength(0);
  });

  it("reads the unread summary", async () => {
    const { auth } = fakeAuth(() => ok({ unreadCount: 4, byContext: { SALE: 3, SECURITY: 1 } }));
    expect(await createNotifications({ auth }).inbox.unreadCount()).toEqual({
      unreadCount: 4,
      byContext: { SALE: 3, SECURITY: 1 },
    });
  });

  it("marks one read, acknowledges, opens and deletes with the right calls", async () => {
    const { auth, calls } = fakeAuth(({ url }) => {
      if (url.endsWith("/read"))
        return ok({ id: "n1", readAt: "2026-10-30T10:01:00Z", unreadCount: 2 });
      if (url.endsWith("/ack"))
        return ok({ id: "n1", acknowledgedAt: "2026-10-30T10:02:00Z", unreadCount: 1 });
      if (url.endsWith("/opened")) return ok({ id: "n1", recorded: true });
      return ok({ id: "n1", unreadCount: 0 });
    });
    const { inbox } = createNotifications({ auth });

    expect((await inbox.markRead("n1")).unreadCount).toBe(2);
    expect((await inbox.acknowledge("n1")).unreadCount).toBe(1);
    expect(await inbox.markOpened("n1")).toEqual({ id: "n1", recorded: true });
    expect((await inbox.remove("n1")).unreadCount).toBe(0);

    expect(calls.map((c) => `${c.method} ${c.url}`)).toEqual([
      "patch /notifications/n1/read",
      "post /notifications/n1/ack",
      "post /notifications/n1/opened",
      "delete /notifications/n1",
    ]);
  });

  it("marks everything, or one context, as read", async () => {
    const { auth, calls } = fakeAuth(() => ok({ updated: 5, unreadCount: 0 }));
    const { inbox } = createNotifications({ auth });

    expect(await inbox.markAllRead()).toEqual({ updated: 5, unreadCount: 0 });
    await inbox.markAllRead({ context: "SALE" });
    expect(calls[0]?.body).toEqual({});
    expect(calls[1]?.body).toEqual({ context: "SALE" });
  });

  it("escapes the id in the path and refuses an empty one", async () => {
    const { auth, calls } = fakeAuth(() => ok({ id: "a/b", readAt: null, unreadCount: 0 }));
    const { inbox } = createNotifications({ auth });

    await inbox.markRead("a/b");
    expect(calls[0]?.url).toBe("/notifications/a%2Fb/read");
    await expect(inbox.markRead("  ")).rejects.toThrow(TypeError);
  });

  it("turns a server error into an ApiError with its code", async () => {
    const { auth } = fakeAuth(() => fail(404, "NOTIFICATION_NOT_FOUND"));
    const error = await createNotifications({ auth })
      .inbox.markRead("n9")
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ code: "NOTIFICATION_NOT_FOUND", status: 404 });
  });

  it("rejects an answer it does not understand", async () => {
    const { auth } = fakeAuth(() => ok({ nope: true }));
    await expect(createNotifications({ auth }).inbox.list()).rejects.toBeInstanceOf(ApiError);
  });
});
