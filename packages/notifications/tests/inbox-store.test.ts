import { describe, expect, it, vi } from "vitest";
import { createInboxStore, createNotifications } from "../src/index";
import type { Context, InboxPage, NotificationItem, UnreadSummary } from "../src/index";
import { fakeAuth, ok } from "./helpers";

const NOW = Date.parse("2026-10-30T12:00:00.000Z");

function item(
  id: string,
  context: Context = "PURCHASE",
  readAt: string | null = null,
): NotificationItem {
  return {
    id,
    type: "order.placed",
    context,
    priority: "NORMAL",
    title: id,
    body: "",
    data: null,
    readAt,
    acknowledgedAt: null,
    createdAt: "2026-10-30T10:00:00.000Z",
  };
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const FIRST: InboxPage = {
  items: [item("a"), item("b"), item("c", "SALE")],
  nextCursor: "c1",
  unreadCount: 3,
};
const SUMMARY: UnreadSummary = { unreadCount: 3, byContext: { PURCHASE: 2, SALE: 1 } };

function setup(page: InboxPage = FIRST, summary: UnreadSummary = SUMMARY) {
  const inbox = {
    list: vi.fn<(typeof import("../src/index"))["createInboxStore"] extends never ? never : any>(),
  } as any;
  inbox.list = vi.fn(async () => page);
  inbox.unreadCount = vi.fn(async () => summary);
  inbox.markRead = vi.fn(async (id: string) => ({ id, readAt: "x", unreadCount: 2 }));
  inbox.acknowledge = vi.fn(async (id: string) => ({ id, acknowledgedAt: "x", unreadCount: 2 }));
  inbox.markAllRead = vi.fn(async () => ({ updated: 1, unreadCount: 0 }));
  inbox.remove = vi.fn(async (id: string) => ({ id, unreadCount: 2 }));
  inbox.markOpened = vi.fn();
  const onError = vi.fn();
  const store = createInboxStore({ inbox, now: () => NOW, onError });
  return { inbox, store, onError };
}

const ids = (store: ReturnType<typeof setup>["store"]) => store.getState().items.map((i) => i.id);

describe("loading", () => {
  it("loads the first page and the unread counts", async () => {
    const { store } = setup();
    await store.load();
    expect(store.getState()).toMatchObject({
      status: "ready",
      nextCursor: "c1",
      unreadCount: 3,
      byContext: { PURCHASE: 2, SALE: 1 },
    });
    expect(ids(store)).toEqual(["a", "b", "c"]);
  });

  it("asks the server once when loaded twice at the same time", async () => {
    const { store, inbox } = setup();
    await Promise.all([store.load(), store.load()]);
    expect(inbox.list).toHaveBeenCalledTimes(1);
  });

  it("reports a failure in the state instead of rejecting", async () => {
    const { store, inbox, onError } = setup();
    const error = new Error("down");
    inbox.list.mockRejectedValueOnce(error);
    await store.load();
    expect(store.getState()).toMatchObject({ status: "error", error });
    expect(onError).toHaveBeenCalledWith(error);
  });

  it("keeps the items when a refresh fails", async () => {
    const { store, inbox } = setup();
    await store.load();
    inbox.list.mockRejectedValueOnce(new Error("down"));
    await store.refresh();
    expect(store.getState().status).toBe("ready");
    expect(store.getState().error).toBeInstanceOf(Error);
    expect(ids(store)).toEqual(["a", "b", "c"]);
  });

  it("appends the next page without repeating an item", async () => {
    const { store, inbox } = setup();
    await store.load();
    inbox.list.mockResolvedValueOnce({
      items: [item("c", "SALE"), item("d")],
      nextCursor: null,
      unreadCount: 3,
    });
    await store.loadMore();

    expect(inbox.list).toHaveBeenLastCalledWith({ cursor: "c1" });
    expect(ids(store)).toEqual(["a", "b", "c", "d"]);
    expect(store.getState().nextCursor).toBeNull();

    await store.loadMore();
    expect(inbox.list).toHaveBeenCalledTimes(2);
  });

  it("does not load the same page twice at once", async () => {
    const { store, inbox } = setup();
    await store.load();
    await Promise.all([store.loadMore(), store.loadMore()]);
    expect(inbox.list).toHaveBeenCalledTimes(2);
  });

  it("reloads with the context filter", async () => {
    const { store, inbox } = setup();
    await store.load();
    await store.setContext("SALE");
    expect(inbox.list).toHaveBeenLastCalledWith({ context: "SALE" });
    expect(store.getState().context).toBe("SALE");
  });

  it("drops an answer that arrives after a reset", async () => {
    const { store, inbox } = setup();
    const slow = deferred<InboxPage>();
    inbox.list.mockReturnValueOnce(slow.promise);
    const loading = store.load();
    store.reset();
    slow.resolve(FIRST);
    await loading;
    expect(store.getState().items).toEqual([]);
    expect(store.getState().status).toBe("idle");
  });
});

describe("actions", () => {
  it("shows a read at once and takes the server's count after", async () => {
    const { store, inbox } = setup();
    await store.load();
    const answer = deferred<{ id: string; readAt: string; unreadCount: number }>();
    inbox.markRead.mockReturnValueOnce(answer.promise);

    const pending = store.markRead("a");
    expect(store.getState().unreadCount).toBe(2);
    expect(store.getState().byContext).toEqual({ PURCHASE: 1, SALE: 1 });
    expect(store.getState().items[0]?.readAt).toBe("2026-10-30T12:00:00.000Z");

    answer.resolve({ id: "a", readAt: "x", unreadCount: 2 });
    await pending;
    expect(store.getState().unreadCount).toBe(2);
  });

  it("puts things back, asks the server and rejects when it refuses", async () => {
    const { store, inbox } = setup();
    await store.load();
    inbox.markRead.mockRejectedValueOnce(new Error("nope"));

    await expect(store.markRead("a")).rejects.toThrow("nope");
    expect(store.getState().items[0]?.readAt).toBeNull();
    expect(store.getState().unreadCount).toBe(3);
    await vi.waitFor(() => expect(inbox.list).toHaveBeenCalledTimes(2));
  });

  it("does not count a read item twice", async () => {
    const { store } = setup(
      { items: [item("a", "PURCHASE", "2026-10-30T09:00:00Z")], nextCursor: null, unreadCount: 0 },
      {
        unreadCount: 0,
        byContext: {},
      },
    );
    await store.load();
    store.markRead("a").catch(() => undefined);
    expect(store.getState().unreadCount).toBe(0);
  });

  it("acknowledges: reads it and marks it acknowledged", async () => {
    const { store } = setup();
    await store.load();
    await store.acknowledge("c");
    const c = store.getState().items.find((i) => i.id === "c");
    expect(c?.readAt).not.toBeNull();
    expect(c?.acknowledgedAt).not.toBeNull();
    expect(store.getState().byContext).toEqual({ PURCHASE: 2 });
  });

  it("marks everything read", async () => {
    const { store, inbox } = setup();
    await store.load();
    await store.markAllRead();
    expect(inbox.markAllRead).toHaveBeenCalledWith({});
    expect(store.getState().items.every((i) => i.readAt)).toBe(true);
    expect(store.getState()).toMatchObject({ unreadCount: 0, byContext: {} });
  });

  it("marks one context read", async () => {
    const { store, inbox } = setup();
    inbox.markAllRead.mockResolvedValueOnce({ updated: 1, unreadCount: 2 });
    await store.load();
    await store.markAllRead("SALE");
    expect(inbox.markAllRead).toHaveBeenCalledWith({ context: "SALE" });
    expect(store.getState().items.map((i) => Boolean(i.readAt))).toEqual([false, false, true]);
    expect(store.getState()).toMatchObject({ unreadCount: 2, byContext: { PURCHASE: 2 } });
  });

  it("removes an item and its unread count", async () => {
    const { store } = setup();
    await store.load();
    await store.remove("a");
    expect(ids(store)).toEqual(["b", "c"]);
    expect(store.getState().byContext).toEqual({ PURCHASE: 1, SALE: 1 });
  });

  it("removes a read item without touching the counts", async () => {
    const { store, inbox } = setup(
      {
        items: [item("a"), item("d", "PURCHASE", "2026-10-30T09:00:00Z")],
        nextCursor: null,
        unreadCount: 1,
      },
      { unreadCount: 1, byContext: { PURCHASE: 1 } },
    );
    inbox.remove.mockResolvedValueOnce({ id: "d", unreadCount: 1 });
    await store.load();
    await store.remove("d");
    expect(ids(store)).toEqual(["a"]);
    expect(store.getState().unreadCount).toBe(1);
  });
});

describe("live updates", () => {
  it("adds a new notification on top and counts it", async () => {
    const { store } = setup();
    await store.load();
    store.applyNew({ notification: item("z", "SALE"), unreadCount: 4 });
    expect(ids(store)).toEqual(["z", "a", "b", "c"]);
    expect(store.getState()).toMatchObject({ unreadCount: 4, byContext: { PURCHASE: 2, SALE: 2 } });
  });

  it("ignores an event it already knows", async () => {
    const { store } = setup();
    await store.load();
    store.applyNew({ notification: item("z", "SALE"), unreadCount: 4 });
    store.applyNew({ notification: item("z", "SALE"), unreadCount: 4 });
    expect(ids(store)).toEqual(["z", "a", "b", "c"]);
    expect(store.getState().byContext.SALE).toBe(2);
  });

  it("counts a notification outside the shown context without listing it", async () => {
    const { store } = setup();
    await store.load();
    await store.setContext("PURCHASE");
    store.applyNew({ notification: item("z", "SALE"), unreadCount: 4 });
    expect(ids(store)).not.toContain("z");
    expect(store.getState().unreadCount).toBe(4);
    expect(store.getState().byContext.SALE).toBe(2);
  });

  it("only counts before the first load, so the load stays the truth", () => {
    const { store } = setup();
    store.applyNew({ notification: item("z"), unreadCount: 1 });
    expect(store.getState().items).toEqual([]);
    expect(store.getState().unreadCount).toBe(1);
  });

  it("applies a read of some ids", async () => {
    const { store, inbox } = setup();
    await store.load();
    store.applyRead({ ids: ["a"], unreadCount: 2 });
    expect(store.getState().items[0]?.readAt).not.toBeNull();
    expect(store.getState()).toMatchObject({ unreadCount: 2, byContext: { PURCHASE: 1, SALE: 1 } });
    expect(inbox.unreadCount).toHaveBeenCalledTimes(1);
  });

  it("asks for the counts again when an id is not loaded", async () => {
    const { store, inbox } = setup();
    await store.load();
    inbox.unreadCount.mockResolvedValueOnce({
      unreadCount: 2,
      byContext: { PURCHASE: 1, SALE: 1 },
    });
    store.applyRead({ ids: ["not-loaded"], unreadCount: 2 });
    await vi.waitFor(() => expect(store.getState().byContext).toEqual({ PURCHASE: 1, SALE: 1 }));
  });

  it("applies a read of everything, or of one context", async () => {
    const { store } = setup();
    await store.load();
    store.applyRead({ all: true, context: "SALE", unreadCount: 2 });
    expect(store.getState().items.map((i) => Boolean(i.readAt))).toEqual([false, false, true]);
    expect(store.getState().byContext).toEqual({ PURCHASE: 2 });

    store.applyRead({ all: true, context: null, unreadCount: 0 });
    expect(store.getState().items.every((i) => i.readAt)).toBe(true);
    expect(store.getState()).toMatchObject({ unreadCount: 0, byContext: {} });
  });

  it("applies a delete", async () => {
    const { store } = setup();
    await store.load();
    store.applyDeleted({ ids: ["a"], unreadCount: 2 });
    expect(ids(store)).toEqual(["b", "c"]);
    expect(store.getState()).toMatchObject({ unreadCount: 2, byContext: { PURCHASE: 1, SALE: 1 } });
  });

  it("tells the subscribers about each change, and stops when asked", async () => {
    const { store } = setup();
    const seen: number[] = [];
    const stop = store.subscribe((state) => seen.push(state.unreadCount));
    await store.load();
    stop();
    store.applyRead({ all: true, unreadCount: 0 });
    expect(seen[seen.length - 1]).toBe(3);
  });
});

describe("with the session", () => {
  const server = ({ url }: { url: string }) =>
    url === "/notifications/unread-count"
      ? ok({ unreadCount: 1, byContext: { PURCHASE: 1 } })
      : ok({ items: [item("a")], nextCursor: null, unreadCount: 1 });

  it("empties the inbox when the person signs out", async () => {
    const { auth, signIn } = fakeAuth(server);
    const notifications = createNotifications({ auth });
    notifications.start();
    await notifications.store.load();
    expect(notifications.store.getState().items).toHaveLength(1);

    signIn(null);
    expect(notifications.store.getState()).toMatchObject({ items: [], status: "idle" });
  });

  it("empties the inbox when another person signs in", async () => {
    const { auth, signIn } = fakeAuth(server);
    const notifications = createNotifications({ auth });
    notifications.start();
    await notifications.store.load();

    signIn("user-2");
    expect(notifications.store.getState().items).toEqual([]);
  });

  it("leaves the inbox alone once stopped", async () => {
    const { auth, signIn } = fakeAuth(server);
    const notifications = createNotifications({ auth });
    notifications.start();
    await notifications.store.load();
    notifications.stop();

    signIn(null);
    expect(notifications.store.getState().items).toHaveLength(1);
  });
});
