import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createAuth, createMemoryStorage } from "../src/index";
import type { AuthLogEvent } from "../src/index";
import { createFakeAuthServer, createTestAdapter } from "../src/testing/index";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000_000_000);
  vi.spyOn(Math, "random").mockReturnValue(0);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

function setup(logger: (event: AuthLogEvent) => void) {
  const server = createFakeAuthServer();
  server.addUser({ email: "gael@example.com", password: "secret-password-1" });
  const auth = createAuth({
    baseUrl: "https://api.example.com",
    adapter: createTestAdapter("ANDROID", createMemoryStorage()),
    transport: server.transport,
    logger,
  });
  return { auth, server };
}

const names = (events: AuthLogEvent[]) => events.map((e) => e.name);

describe("logger", () => {
  it("reports a refresh from start to end", async () => {
    const events: AuthLogEvent[] = [];
    const { auth } = setup((e) => events.push(e));
    await auth.login.password({ email: "gael@example.com", password: "secret-password-1" });
    await auth.session.refreshNow();

    expect(names(events)).toEqual(expect.arrayContaining(["refresh.start", "refresh.ok"]));
  });

  it("reports a failed refresh with its code and status", async () => {
    const events: AuthLogEvent[] = [];
    const { auth, server } = setup((e) => events.push(e));
    await auth.login.password({ email: "gael@example.com", password: "secret-password-1" });
    server.setOffline(true);
    await auth.session.refreshNow().catch(() => undefined);

    expect(events.find((e) => e.name === "refresh.failed")).toEqual({
      level: "warn",
      name: "refresh.failed",
      detail: { code: "NETWORK_ERROR", status: null },
    });
  });

  it("reports the end of a session with its reason", async () => {
    const events: AuthLogEvent[] = [];
    const { auth, server } = setup((e) => events.push(e));
    await auth.login.password({ email: "gael@example.com", password: "secret-password-1" });
    server.revokeSessions();
    await auth.session.refreshNow().catch(() => undefined);

    const ended = events.find((e) => e.name === "session.ended");
    expect(ended?.detail?.reason).toBe("SESSION_REVOKED");
  });

  it("reports the planned refresh and the retries", async () => {
    const events: AuthLogEvent[] = [];
    const { auth, server } = setup((e) => events.push(e));
    await auth.start();
    await auth.login.password({ email: "gael@example.com", password: "secret-password-1" });
    server.setOffline(true);

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    const planned = events.find((e) => e.name === "token.scheduled");
    expect(planned?.detail?.inSeconds).toEqual(expect.any(Number));
    expect(events.find((e) => e.name === "token.retry")?.detail).toEqual({ afterSeconds: 5 });
    auth.stop();
  });

  it("reports a request sent again after an expired token, by path only", async () => {
    const events: AuthLogEvent[] = [];
    const { auth, server } = setup((e) => events.push(e));
    await auth.login.password({ email: "gael@example.com", password: "secret-password-1" });
    server.expireAccessTokens();
    await auth.me();

    const retried = events.find((e) => e.name === "request.retried");
    expect(retried?.detail).toEqual({ path: "/auth/me", code: "TOKEN_EXPIRED" });
  });

  it("never gets a token, a code or a password", async () => {
    const events: AuthLogEvent[] = [];
    const { auth, server } = setup((e) => events.push(e));
    await auth.start();
    await auth.login.password({ email: "gael@example.com", password: "secret-password-1" });
    server.expireAccessTokens();
    await auth.me();
    await auth.session.refreshNow();
    server.setOffline(true);
    await auth.session.refreshNow().catch(() => undefined);
    await vi.advanceTimersByTimeAsync(11 * 60_000);

    const everything = JSON.stringify(events);
    expect(events.length).toBeGreaterThan(5);
    expect(everything).not.toMatch(/access-\d|refresh-\d|secret-password-1|123456|gael@example/);
    auth.stop();
  });

  it("is not broken by a logger that throws", async () => {
    const { auth } = setup(() => {
      throw new Error("bad logger");
    });
    await auth.login.password({ email: "gael@example.com", password: "secret-password-1" });
    await expect(auth.session.refreshNow()).resolves.toBeUndefined();
  });

  it("is optional", async () => {
    const server = createFakeAuthServer();
    server.addUser({ email: "gael@example.com", password: "secret-password-1" });
    const auth = createAuth({
      baseUrl: "https://api.example.com",
      adapter: createTestAdapter(),
      transport: server.transport,
    });
    await auth.login.password({ email: "gael@example.com", password: "secret-password-1" });
    await auth.session.refreshNow();
  });
});
