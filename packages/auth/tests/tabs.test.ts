import { describe, expect, it, vi } from "vitest";
import {
  createAuth,
  createMemoryStorage,
  createRefreshManager,
  createSessionStore,
} from "../src/index";
import { createHttpClient } from "../src/index";
import type { AuthAdapter } from "../src/index";
import { createTabCoordination, createWebAdapter } from "../src/web/index";
import type { ChannelLike } from "../src/web/index";
import { createFakeAuthServer } from "../src/testing/index";

/** Tabs of one browser: one lock queue and one broadcast bus, shared by every adapter. */
function browser() {
  let queue: Promise<unknown> = Promise.resolve();
  const channels = new Set<FakeChannel>();

  class FakeChannel implements ChannelLike {
    listeners = new Set<(event: { data: unknown }) => void>();
    closed = false;
    constructor() {
      channels.add(this);
    }
    postMessage(message: unknown): void {
      for (const other of channels) {
        if (other === this || other.closed) continue;
        for (const listener of other.listeners) listener({ data: message });
      }
    }
    addEventListener(_t: "message", l: (event: { data: unknown }) => void): void {
      this.listeners.add(l);
    }
    removeEventListener(_t: "message", l: (event: { data: unknown }) => void): void {
      this.listeners.delete(l);
    }
    close(): void {
      this.closed = true;
      channels.delete(this);
    }
  }

  const locks = {
    request<T>(_name: string, callback: () => Promise<T>): Promise<T> {
      const run = queue.then(callback);
      queue = run.catch(() => undefined);
      return run;
    },
  };

  return {
    tab: () => createTabCoordination({ locks, createChannel: () => new FakeChannel() }),
    openChannels: () => channels.size,
  };
}

describe("createTabCoordination", () => {
  it("runs the work under the shared lock, one tab after the other", async () => {
    const env = browser();
    const [one, two] = [env.tab(), env.tab()];
    const order: string[] = [];
    const slow = (name: string, ms: number) => async () => {
      order.push(`${name} start`);
      await new Promise((r) => setTimeout(r, ms));
      order.push(`${name} end`);
    };

    await Promise.all([one.withRefreshLock!(slow("a", 20)), two.withRefreshLock!(slow("b", 1))]);
    expect(order).toEqual(["a start", "a end", "b start", "b end"]);
  });

  it("runs the work anyway when the browser has no Web Locks", async () => {
    const tab = createTabCoordination({});
    expect(await tab.withRefreshLock!(async () => 42)).toBe(42);
  });

  it("tells the other tabs about a refresh, and ignores unrelated messages", () => {
    const env = browser();
    const [one, two] = [env.tab(), env.tab()];
    const heard = vi.fn();
    two.onRefreshedElsewhere!(heard);

    one.announceRefresh!(900);
    expect(heard).toHaveBeenCalledWith(900);

    // Not a usable lifetime: nothing to hear.
    one.announceRefresh!(Number.NaN);
    one.announceRefresh!(-5);
    expect(heard).toHaveBeenCalledTimes(1);
  });

  it("stops listening and closes its channel", () => {
    const env = browser();
    const [one, two] = [env.tab(), env.tab()];
    const heard = vi.fn();
    const stop = two.onRefreshedElsewhere!(heard);
    stop();
    one.announceRefresh!(900);
    expect(heard).not.toHaveBeenCalled();
  });

  it("does nothing without BroadcastChannel", () => {
    const tab = createTabCoordination({});
    expect(() => tab.announceRefresh!(900)).not.toThrow();
    expect(() => tab.onRefreshedElsewhere!(vi.fn())()).not.toThrow();
  });

  it("is part of the web adapter", () => {
    const adapter = createWebAdapter({ storage: createMemoryStorage(), tabs: {} });
    expect(typeof adapter.withRefreshLock).toBe("function");
    expect(typeof adapter.announceRefresh).toBe("function");
  });
});

describe("two tabs sharing one cookie session", () => {
  function twoTabs() {
    const server = createFakeAuthServer();
    server.addUser({ email: "gael@example.com", password: "secret123" });
    const env = browser();
    const make = () => {
      const adapter: AuthAdapter = {
        ...createWebAdapter({ storage: createMemoryStorage(), tabs: {} }),
        ...env.tab(),
      };
      return createAuth({
        baseUrl: "https://api.example.com",
        adapter,
        transport: server.transport,
      });
    };
    return { server, tabA: make(), tabB: make(), env };
  }

  it("refreshes once when both tabs ask at the same time", async () => {
    const { server, tabA, tabB } = twoTabs();
    await tabA.start();
    await tabB.start();
    await tabA.login.password({ email: "gael@example.com", password: "secret123" });

    await Promise.all([tabA.session.refreshNow(), tabB.session.refreshNow()]);

    expect(server.requests.filter((r) => r.path === "/auth/refresh")).toHaveLength(1);
    tabA.stop();
    tabB.stop();
  });

  it("lets the tab that waited adopt the expiry the other one got", async () => {
    const { tabA, tabB } = twoTabs();
    await tabA.start();
    await tabB.start();
    await tabA.login.password({ email: "gael@example.com", password: "secret123" });

    await Promise.all([tabA.session.refreshNow(), tabB.session.refreshNow()]);
    expect(tabB.session.getState().accessExpiresAt).not.toBeNull();
    tabA.stop();
    tabB.stop();
  });

  it("refreshes again later, because adoption only covers the wait", async () => {
    const { server, tabA, tabB } = twoTabs();
    await tabA.start();
    await tabB.start();
    await tabA.login.password({ email: "gael@example.com", password: "secret123" });

    await tabA.session.refreshNow();
    await tabB.session.refreshNow();
    expect(server.requests.filter((r) => r.path === "/auth/refresh")).toHaveLength(2);
    tabA.stop();
    tabB.stop();
  });

  it("stops listening to the other tabs when stopped", async () => {
    const { tabA, env } = twoTabs();
    await tabA.start();
    const open = env.openChannels();
    tabA.stop();
    expect(env.openChannels()).toBeLessThan(open);
  });
});

describe("a refresh manager without tabs", () => {
  it("is unchanged for phones", async () => {
    const server = createFakeAuthServer();
    const store = createSessionStore({ platform: "ANDROID", storage: createMemoryStorage() });
    const client = createHttpClient({
      baseUrl: "https://api.example.com",
      adapter: server.transport,
    });
    const manager = createRefreshManager({ client, platform: "ANDROID", store });
    expect(manager.watchOtherTabs()()).toBeUndefined();
  });
});
