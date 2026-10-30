// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { createElement, useState } from "react";
import type { ReactElement } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createNotifications } from "../src/index";
import type { Notifications, NotificationItem, PushOpenEvent } from "../src/index";
import {
  NotificationsProvider,
  useInbox,
  useNotifications,
  usePreferences,
  usePush,
  usePushOpen,
  useRealtimeState,
  useUnreadByContext,
  useUnreadCount,
} from "../src/react/index";
import type { Realtime, RealtimeState } from "../src/realtime/index";
import { createFakeNotificationsServer, createFakePushProvider } from "../src/testing/index";
import type { FakePushProvider } from "../src/testing/index";
import { authOver } from "./helpers";

afterEach(cleanup);

function setup(push?: FakePushProvider) {
  const server = createFakeNotificationsServer();
  const { auth, signIn } = authOver(server.transport);
  const notifications = createNotifications({ auth, push });
  return { server, notifications, signIn };
}

const mount = (notifications: Notifications, child: ReactElement, realtime?: Realtime) =>
  render(createElement(NotificationsProvider, { notifications, realtime }, child));

const out = (): string | null => screen.getByTestId("out").textContent;

function fakeRealtime() {
  let state: RealtimeState = { status: "idle", error: null };
  const listeners = new Set<(state: RealtimeState) => void>();
  return {
    getState: () => state,
    subscribe: (listener: (state: RealtimeState) => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    start: vi.fn(),
    stop: vi.fn(),
    reconnect: vi.fn(),
    set(next: RealtimeState) {
      state = next;
      for (const listener of [...listeners]) listener(state);
    },
  };
}

const live: NotificationItem = {
  id: "live-1",
  type: "order.placed",
  context: "PURCHASE",
  priority: "NORMAL",
  title: "live",
  body: "",
  data: null,
  readAt: null,
  acknowledgedAt: null,
  createdAt: "2026-10-30T10:00:00.000Z",
};

describe("NotificationsProvider", () => {
  it("starts the notifications and the live connection, and stops them on unmount", () => {
    const { notifications } = setup();
    const realtime = fakeRealtime();
    const start = vi.spyOn(notifications, "start");
    const stop = vi.spyOn(notifications, "stop");
    const view = mount(notifications, createElement("div"), realtime);

    expect(start).toHaveBeenCalledTimes(1);
    expect(realtime.start).toHaveBeenCalledTimes(1);
    view.unmount();
    expect(stop).toHaveBeenCalledTimes(1);
    expect(realtime.stop).toHaveBeenCalledTimes(1);
  });

  it("gives the hooks the notifications object", () => {
    const { notifications } = setup();
    let seen: Notifications | null = null;
    function Probe() {
      seen = useNotifications();
      return null;
    }
    mount(notifications, createElement(Probe));
    expect(seen).toBe(notifications);
  });

  it("refuses hooks used outside the provider", () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    function Probe() {
      useInbox();
      return null;
    }
    expect(() => render(createElement(Probe))).toThrow("NotificationsProvider");
    quiet.mockRestore();
  });
});

describe("useInbox", () => {
  function Inbox({ autoLoad }: { autoLoad?: boolean }) {
    const inbox = useInbox({ autoLoad });
    return createElement(
      "div",
      null,
      createElement(
        "span",
        { "data-testid": "out" },
        `${inbox.status}:${inbox.items.map((item) => item.title).join(",")}:${inbox.unreadCount}`,
      ),
      createElement(
        "button",
        { onClick: () => void inbox.markRead(inbox.items[0]?.id ?? "") },
        "read",
      ),
      createElement("button", { onClick: () => void inbox.markAllRead() }, "read all"),
    );
  }

  it("loads the first page once and shows it", async () => {
    const { server, notifications } = setup();
    server.add({ title: "first" });
    server.add({ title: "second" });
    mount(notifications, createElement(Inbox));

    expect(out()).toBe("loading::0");
    await waitFor(() => expect(out()).toBe("ready:second,first:2"));
    expect(server.requests.filter((request) => request.path === "/notifications")).toHaveLength(1);
  });

  it("does not load when told not to", () => {
    const { server, notifications } = setup();
    mount(notifications, createElement(Inbox, { autoLoad: false }));
    expect(out()).toBe("idle::0");
    expect(server.requests).toEqual([]);
  });

  it("follows the live events", async () => {
    const { server, notifications } = setup();
    server.add({ title: "first" });
    mount(notifications, createElement(Inbox));
    await waitFor(() => expect(out()).toBe("ready:first:1"));

    act(() => notifications.store.applyNew({ notification: live, unreadCount: 2 }));
    expect(out()).toBe("ready:live,first:2");
  });

  it("runs the actions", async () => {
    const { server, notifications } = setup();
    server.add({ title: "first" });
    server.add({ title: "second" });
    mount(notifications, createElement(Inbox));
    await waitFor(() => expect(out()).toBe("ready:second,first:2"));

    fireEvent.click(screen.getByText("read"));
    await waitFor(() => expect(out()).toBe("ready:second,first:1"));
    fireEvent.click(screen.getByText("read all"));
    await waitFor(() => expect(out()).toBe("ready:second,first:0"));
  });

  it("does not load again by itself after the person signs out", async () => {
    const { server, notifications, signIn } = setup();
    mount(notifications, createElement(Inbox));
    await waitFor(() => expect(out()).toBe("ready::0"));

    act(() => signIn(null));
    await waitFor(() => expect(out()).toBe("idle::0"));
    expect(server.requests.filter((request) => request.path === "/notifications")).toHaveLength(1);
  });
});

describe("unread hooks", () => {
  function Badge() {
    const count = useUnreadCount();
    const byContext = useUnreadByContext();
    const sorted = Object.entries(byContext)
      .sort()
      .map(([context, total]) => `${context}=${total}`);
    return createElement("span", { "data-testid": "out" }, `${count}:${sorted.join(",")}`);
  }

  it("shows the badge without loading the inbox, then follows the events", async () => {
    const { server, notifications } = setup();
    server.add({ context: "SALE" });
    server.add({ context: "PURCHASE" });
    mount(notifications, createElement(Badge));

    await waitFor(() => expect(out()).toBe("2:PURCHASE=1,SALE=1"));
    expect(server.requests.map((request) => request.path)).toEqual(["/notifications/unread-count"]);

    act(() => notifications.store.applyNew({ notification: live, unreadCount: 3 }));
    expect(out()).toBe("3:PURCHASE=2,SALE=1");
  });
});

describe("usePreferences", () => {
  function Preferences() {
    const view = usePreferences();
    return createElement(
      "div",
      null,
      createElement(
        "span",
        { "data-testid": "out" },
        `${view.status}:${view.preferences?.settings.marketingEmailOptIn ?? "-"}:${view.preferences?.categories[0]?.channels[0]?.enabled ?? "-"}`,
      ),
      createElement(
        "button",
        { onClick: () => void view.updateSettings({ marketingEmailOptIn: true }) },
        "consent",
      ),
      createElement(
        "button",
        { onClick: () => void view.update([{ context: "SALE", channel: "SMS", enabled: false }]) },
        "sms off",
      ),
    );
  }

  const withCategory = (server: ReturnType<typeof setup>["server"]) => {
    server.preferences.categories = [
      {
        context: "SALE",
        label: "Mes ventes",
        locked: false,
        hasMandatory: false,
        channels: [{ channel: "SMS", locked: false, enabled: true }],
      },
    ];
  };

  it("loads, then applies a change to the settings and to a channel", async () => {
    const { server, notifications } = setup();
    withCategory(server);
    mount(notifications, createElement(Preferences));

    expect(out()).toBe("loading:-:-");
    await waitFor(() => expect(out()).toBe("ready:false:true"));
    fireEvent.click(screen.getByText("consent"));
    await waitFor(() => expect(out()).toBe("ready:true:true"));
    fireEvent.click(screen.getByText("sms off"));
    await waitFor(() => expect(out()).toBe("ready:true:false"));
  });

  it("reports a failed load", async () => {
    const { server, notifications } = setup();
    server.setOffline(true);
    mount(notifications, createElement(Preferences));
    await waitFor(() => expect(out()).toBe("error:-:-"));
  });
});

describe("push hooks", () => {
  function Push() {
    const push = usePush();
    return createElement(
      "div",
      null,
      createElement("span", { "data-testid": "out" }, `${push.status}:${push.registered}`),
      createElement("button", { onClick: () => void push.requestPermission() }, "allow"),
      createElement("button", { onClick: () => void push.disable() }, "off"),
    );
  }

  it("is off without a provider", () => {
    const { notifications } = setup();
    mount(notifications, createElement(Push));
    expect(out()).toBe("disabled:false");
  });

  it("registers the device, and follows the choices of the person", async () => {
    const provider = createFakePushProvider({ permission: "undetermined" });
    const { server, notifications } = setup(provider);
    mount(notifications, createElement(Push));

    await waitFor(() => expect(out()).toBe("permission-needed:false"));
    fireEvent.click(screen.getByText("allow"));
    await waitFor(() => expect(out()).toBe("enabled:true"));
    expect(server.devices).toHaveLength(1);

    fireEvent.click(screen.getByText("off"));
    await waitFor(() => expect(out()).toBe("disabled:false"));
    expect(server.devices).toHaveLength(0);
  });

  it("tells the screen when the person opens the app from a push", async () => {
    const provider = createFakePushProvider();
    const { notifications } = setup(provider);
    const heard: PushOpenEvent[] = [];
    let listener = (event: PushOpenEvent): void => void heard.push(event);

    function Opens() {
      const [label, setLabel] = useState("first");
      usePushOpen((event) => {
        listener(event);
        setLabel(event.type ?? "none");
      });
      usePush();
      return createElement("span", { "data-testid": "out" }, label);
    }
    mount(notifications, createElement(Opens));
    await waitFor(() => expect(notifications.push.getState().status).toBe("enabled"));

    act(() => provider.tap({ notificationId: "n1", type: "order.placed" }));
    expect(out()).toBe("order.placed");
    expect(heard).toEqual([{ notificationId: "n1", type: "order.placed" }]);
    listener = () => {};
  });
});

describe("useRealtimeState", () => {
  function Live() {
    return createElement("span", { "data-testid": "out" }, useRealtimeState().status);
  }

  it("stays idle when no live connection was given", () => {
    const { notifications } = setup();
    mount(notifications, createElement(Live));
    expect(out()).toBe("idle");
  });

  it("follows the live connection", () => {
    const { notifications } = setup();
    const realtime = fakeRealtime();
    mount(notifications, createElement(Live), realtime);

    act(() => realtime.set({ status: "connected", error: null }));
    expect(out()).toBe("connected");
  });
});
