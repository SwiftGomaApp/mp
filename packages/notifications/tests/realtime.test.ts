import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRealtime } from "../src/realtime/index";
import type { SocketConnectOptions, SocketLike } from "../src/realtime/index";
import type { InboxState } from "../src/index";
import { fakeAuth, ok } from "./helpers";
import type { FakeAuthOptions } from "./helpers";

class FakeSocket implements SocketLike {
  connected = false;
  disconnects = 0;
  readonly emitted: Array<{ event: string; args: unknown[] }> = [];
  private readonly handlers = new Map<string, Array<(...args: any[]) => void>>();

  constructor(
    readonly url: string,
    readonly options: SocketConnectOptions,
  ) {}

  on(event: string, handler: (...args: any[]) => void): this {
    this.handlers.set(event, [...(this.handlers.get(event) ?? []), handler]);
    return this;
  }

  emit(event: string, ...args: unknown[]): void {
    this.emitted.push({ event, args });
  }

  disconnect(): void {
    this.connected = false;
    this.disconnects += 1;
  }

  fire(event: string, ...args: unknown[]): void {
    for (const handler of this.handlers.get(event) ?? []) handler(...args);
  }

  open(): void {
    this.connected = true;
    this.fire("connect");
  }

  reject(code: string): void {
    this.fire("connect_error", Object.assign(new Error(code), { data: { code } }));
  }
}

const flush = async (): Promise<void> => {
  await vi.advanceTimersByTimeAsync(0);
  await vi.advanceTimersByTimeAsync(0);
};

function setup(
  userId: string | null = "user-1",
  options: FakeAuthOptions = { accessToken: "token-1" },
) {
  const sockets: FakeSocket[] = [];
  const fake = fakeAuth(() => ok(), userId, options);
  const store = {
    applyNew: vi.fn(),
    applyRead: vi.fn(),
    applyDeleted: vi.fn(),
    refresh: vi.fn(async () => {}),
    getState: vi.fn(() => ({ status: "ready" }) as InboxState),
  };
  const onError = vi.fn();
  const realtime = createRealtime({
    auth: fake.auth,
    store,
    onError,
    socketFactory: (url, socketOptions) => {
      const socket = new FakeSocket(url, socketOptions);
      sockets.push(socket);
      return socket;
    },
  });
  const last = (): FakeSocket => sockets[sockets.length - 1] as FakeSocket;
  return { ...fake, sockets, store, onError, realtime, last };
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Math, "random").mockReturnValue(1);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("connecting", () => {
  it("connects to the API origin once somebody is signed in", async () => {
    const { realtime, sockets } = setup();
    realtime.start();
    await flush();

    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.url).toBe("https://api.test");
    expect(sockets[0]?.options).toMatchObject({ path: "/socket.io", reconnection: false });
    expect(realtime.getState().status).toBe("connecting");

    sockets[0]?.open();
    expect(realtime.getState()).toEqual({ status: "connected", error: null });
  });

  it("sends the access token on a phone, fresh at each attempt", async () => {
    const { realtime, last, setToken } = setup();
    realtime.start();
    await flush();

    expect(last().options.withCredentials).toBe(false);
    const handshake = async (): Promise<unknown> => {
      let sent: unknown;
      last().options.auth?.((data) => {
        sent = data;
      });
      await flush();
      return sent;
    };
    expect(await handshake()).toEqual({ token: "token-1" });
    setToken("token-2");
    expect(await handshake()).toEqual({ token: "token-2" });
  });

  it("relies on cookies in a browser", async () => {
    const { realtime, last } = setup("user-1", { platform: "WEB" });
    realtime.start();
    await flush();

    expect(last().options.withCredentials).toBe(true);
    expect(last().options.auth).toBeUndefined();
  });

  it("waits for a signed-in user", async () => {
    const { realtime, sockets, signIn } = setup(null);
    realtime.start();
    await flush();
    expect(sockets).toHaveLength(0);

    signIn("user-1");
    await flush();
    expect(sockets).toHaveLength(1);
  });

  it("closes on sign-out and opens a new one for the next user", async () => {
    const { realtime, sockets, signIn } = setup();
    realtime.start();
    await flush();
    sockets[0]?.open();

    signIn(null);
    expect(sockets[0]?.disconnects).toBe(1);
    expect(realtime.getState().status).toBe("idle");

    signIn("user-2");
    await flush();
    expect(sockets).toHaveLength(2);
  });

  it("stops following the session when stopped", async () => {
    const { realtime, sockets, signIn } = setup(null);
    realtime.start();
    realtime.stop();
    signIn("user-1");
    await flush();
    expect(sockets).toHaveLength(0);
  });

  it("refuses to start without an API address", () => {
    const { auth } = fakeAuth(() => ok());
    auth.api.defaults.baseURL = "";
    expect(() => createRealtime({ auth, store: setup().store })).toThrow(TypeError);
  });
});

describe("live events", () => {
  async function connected() {
    const context = setup();
    context.realtime.start();
    await flush();
    context.last().open();
    return context;
  }

  it("hands the three notification events to the store", async () => {
    const { last, store } = await connected();
    const created = { notification: { id: "n1" }, unreadCount: 1 };

    last().fire("notification:new", created);
    last().fire("notification:read", { ids: ["n1"], unreadCount: 0 });
    last().fire("notification:read", { all: true, context: "SALE", unreadCount: 0 });
    last().fire("notification:deleted", { ids: ["n1"], unreadCount: 0 });

    expect(store.applyNew).toHaveBeenCalledWith(created);
    expect(store.applyRead).toHaveBeenNthCalledWith(1, { ids: ["n1"], unreadCount: 0 });
    expect(store.applyRead).toHaveBeenNthCalledWith(2, {
      all: true,
      context: "SALE",
      unreadCount: 0,
    });
    expect(store.applyDeleted).toHaveBeenCalledWith({ ids: ["n1"], unreadCount: 0 });
  });

  it("ignores a payload it cannot read", async () => {
    const { last, store } = await connected();
    last().fire("notification:new", { unreadCount: 1 });
    last().fire("notification:read", { ids: "n1", unreadCount: 1 });
    last().fire("notification:read", { unreadCount: 1 });
    last().fire("notification:deleted", null);

    expect(store.applyNew).not.toHaveBeenCalled();
    expect(store.applyRead).not.toHaveBeenCalled();
    expect(store.applyDeleted).not.toHaveBeenCalled();
  });

  it("refetches the inbox on connect only when it was loaded", async () => {
    const { realtime, store, last } = setup();
    store.getState.mockReturnValue({ status: "idle" } as InboxState);
    realtime.start();
    await flush();
    last().open();
    expect(store.refresh).not.toHaveBeenCalled();

    store.getState.mockReturnValue({ status: "ready" } as InboxState);
    last().open();
    expect(store.refresh).toHaveBeenCalledTimes(1);
  });
});

describe("failures", () => {
  it("stops for good when the session was revoked", async () => {
    const { realtime, sockets, last } = setup();
    realtime.start();
    await flush();
    last().reject("SESSION_REVOKED");

    expect(realtime.getState()).toEqual({ status: "stopped", error: "SESSION_REVOKED" });
    await vi.advanceTimersByTimeAsync(120_000);
    expect(sockets).toHaveLength(1);
  });

  it.each(["ACCOUNT_BLOCKED", "TWO_FACTOR_REQUIRED", "ORIGIN_NOT_ALLOWED"])(
    "does not retry after %s",
    async (code) => {
      const { realtime, sockets, last } = setup();
      realtime.start();
      await flush();
      last().reject(code);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(sockets).toHaveLength(1);
      expect(realtime.getState().status).toBe("stopped");
    },
  );

  it("renews the session after an expired token, then connects again", async () => {
    const { realtime, sockets, last, refreshNow } = setup();
    realtime.start();
    await flush();
    last().reject("TOKEN_EXPIRED");
    await flush();

    expect(refreshNow).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(2);
  });

  it("still retries when the renewal fails", async () => {
    const { realtime, sockets, last, refreshNow, onError } = setup();
    const failure = new Error("offline");
    refreshNow.mockRejectedValueOnce(failure);
    realtime.start();
    await flush();
    last().reject("UNAUTHORIZED");
    await flush();

    expect(onError).toHaveBeenCalledWith(failure);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(2);
  });

  it("retries with a growing delay, and starts over after a connection", async () => {
    const { realtime, sockets, last } = setup();
    realtime.start();
    await flush();

    last().reject("UNAVAILABLE");
    await vi.advanceTimersByTimeAsync(999);
    expect(sockets).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(2);

    last().reject("UNAVAILABLE");
    await vi.advanceTimersByTimeAsync(1_999);
    expect(sockets).toHaveLength(2);
    await vi.advanceTimersByTimeAsync(1);
    expect(sockets).toHaveLength(3);

    last().open();
    last().fire("disconnect", "transport close");
    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(4);
  });

  it("caps the delay at thirty seconds", async () => {
    const { realtime, sockets, last } = setup();
    realtime.start();
    await flush();
    for (let attempt = 0; attempt < 8; attempt += 1) {
      last().reject("UNAVAILABLE");
      await vi.advanceTimersByTimeAsync(30_000);
    }
    expect(sockets).toHaveLength(9);
  });

  it("reconnects after a lost connection", async () => {
    const { realtime, sockets, last } = setup();
    realtime.start();
    await flush();
    last().open();
    last().fire("disconnect", "ping timeout");
    expect(realtime.getState().status).toBe("disconnected");

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(2);
  });

  it("does not reconnect on its own when the server drops the socket", async () => {
    const { realtime, sockets, last } = setup();
    realtime.start();
    await flush();
    last().open();
    last().fire("disconnect", "io server disconnect");

    await vi.advanceTimersByTimeAsync(120_000);
    expect(sockets).toHaveLength(1);
    expect(realtime.getState().status).toBe("disconnected");
  });

  it("reconnects when the server drops the socket because the token expired", async () => {
    const { realtime, sockets, last } = setup();
    realtime.start();
    await flush();
    last().open();
    last().fire("auth:expired");
    last().fire("disconnect", "io server disconnect");

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(2);
  });
});

describe("token renewal", () => {
  it("renews the session and sends the new token on a phone", async () => {
    const { realtime, sockets, last, refreshNow, setToken } = setup();
    realtime.start();
    await flush();
    last().open();
    setToken("token-2");

    last().fire("auth:expiring");
    await flush();

    expect(refreshNow).toHaveBeenCalledTimes(1);
    expect(last().emitted).toEqual([
      { event: "auth:refresh", args: [{ token: "token-2" }, expect.any(Function)] },
    ]);

    const answer = last().emitted[0]?.args[1] as (reply: unknown) => void;
    answer({ ok: true });
    expect(sockets).toHaveLength(1);
  });

  it("connects again when the server refuses the new token", async () => {
    const { realtime, sockets, last } = setup();
    realtime.start();
    await flush();
    last().open();
    last().fire("auth:expiring");
    await flush();

    const answer = last().emitted[0]?.args[1] as (reply: unknown) => void;
    answer({ ok: false, code: "UNAUTHORIZED" });
    await flush();
    expect(sockets).toHaveLength(2);
    expect(sockets[0]?.disconnects).toBe(1);
  });

  it("connects again in a browser, so the new cookie is sent", async () => {
    const { realtime, sockets, last, refreshNow } = setup("user-1", {
      platform: "WEB",
      accessToken: null,
    });
    realtime.start();
    await flush();
    last().open();
    last().fire("auth:expiring");
    await flush();

    expect(refreshNow).toHaveBeenCalledTimes(1);
    expect(sockets).toHaveLength(2);
    expect(sockets[0]?.emitted).toEqual([]);
  });

  it("reports a failed renewal and keeps the connection", async () => {
    const { realtime, sockets, last, refreshNow, onError } = setup();
    const failure = new Error("offline");
    refreshNow.mockRejectedValueOnce(failure);
    realtime.start();
    await flush();
    last().open();
    last().fire("auth:expiring");
    await flush();

    expect(onError).toHaveBeenCalledWith(failure);
    expect(sockets).toHaveLength(1);
    expect(realtime.getState().status).toBe("connected");
  });
});

describe("reconnect", () => {
  it("connects again now, from a stopped or dropped connection", async () => {
    const { realtime, sockets, last } = setup();
    realtime.start();
    await flush();
    last().reject("SESSION_REVOKED");

    realtime.reconnect();
    await flush();
    expect(sockets).toHaveLength(2);
  });

  it("does nothing while connected or connecting", async () => {
    const { realtime, sockets, last } = setup();
    realtime.start();
    await flush();
    realtime.reconnect();
    last().open();
    realtime.reconnect();
    await flush();
    expect(sockets).toHaveLength(1);
  });

  it("does nothing when nobody is signed in", async () => {
    const { realtime, sockets } = setup(null);
    realtime.start();
    realtime.reconnect();
    await flush();
    expect(sockets).toHaveLength(0);
  });
});

describe("state", () => {
  it("tells subscribers about each change until they leave", async () => {
    const { realtime, last } = setup();
    const seen: string[] = [];
    const stop = realtime.subscribe((state) => seen.push(state.status));
    realtime.start();
    await flush();
    last().open();
    stop();
    realtime.stop();

    expect(seen).toEqual(["connecting", "connected"]);
  });
});
