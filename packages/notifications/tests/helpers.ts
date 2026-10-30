import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { vi } from "vitest";
import type { Mock } from "vitest";
import { createHttpClient } from "swiftgoma-mp-auth";
import type { Auth, AuthUser, Platform, SessionState } from "swiftgoma-mp-auth";
import type { NotificationsAuth } from "../src/index";

export type Reply = { status: number; data?: unknown } | Error;

export interface Seen {
  method: string;
  url: string;
  params: Record<string, unknown> | undefined;
  body: any;
}

export const ok = (data: unknown = {}): Reply => ({ status: 200, data });

export const fail = (status: number, code: string, extra: object = {}): Reply => ({
  status,
  data: { error: { code, message: code, ...extra } },
});

export interface FakeSession {
  session: Auth["session"];
  refreshNow: Mock<Auth["session"]["refreshNow"]>;
  setUser(userId: string | null): void;
  setToken(token: string | null): void;
}

export function fakeSession(
  userId: string | null = null,
  accessToken: string | null = null,
): FakeSession {
  const stateOf = (id: string | null): SessionState<AuthUser> => ({
    status: id ? "authenticated" : "anonymous",
    user: id ? ({ id } as AuthUser) : null,
    accessExpiresAt: null,
  });
  let state = stateOf(userId);
  let token = accessToken;
  const listeners = new Set<(state: SessionState<AuthUser>) => void>();
  const refreshNow = vi.fn<Auth["session"]["refreshNow"]>(async () => {});

  return {
    session: {
      getState: () => state,
      subscribe: (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getAccessToken: async () => token,
      onTokenRefreshed: () => () => {},
      refreshNow,
      onSessionEnded: () => () => {},
    },
    refreshNow,
    setUser(id) {
      state = stateOf(id);
      for (const listener of [...listeners]) listener(state);
    },
    setToken(next) {
      token = next;
    },
  };
}

export interface FakeAuthOptions {
  platform?: Platform;
  accessToken?: string | null;
}

export interface AuthOver {
  auth: NotificationsAuth;
  signIn: FakeSession["setUser"];
  refreshNow: FakeSession["refreshNow"];
  setToken: FakeSession["setToken"];
}

/** An auth stand-in whose Axios client talks to the given transport. */
export function authOver(
  adapter: AxiosAdapter,
  userId: string | null = "user-1",
  options: FakeAuthOptions = {},
): AuthOver {
  const { session, refreshNow, setUser, setToken } = fakeSession(
    userId,
    options.accessToken ?? null,
  );
  return {
    auth: {
      api: createHttpClient({ baseUrl: "https://api.test", adapter }),
      session,
      device: {
        get: async () => ({
          deviceId: "device-12345678",
          deviceName: "Test phone",
          platform: options.platform ?? "ANDROID",
        }),
      },
    },
    signIn: setUser,
    refreshNow,
    setToken,
  };
}

/** Same, with a tiny server that `answer` drives. */
export function fakeAuth(
  answer: (seen: Seen, calls: Seen[]) => Reply,
  userId: string | null = "user-1",
  options: FakeAuthOptions = {},
): AuthOver & { calls: Seen[] } {
  const calls: Seen[] = [];
  const adapter: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const seen: Seen = {
      method: String(config.method),
      url: String(config.url),
      params: config.params,
      body: typeof config.data === "string" ? JSON.parse(config.data) : config.data,
    };
    calls.push(seen);

    const reply = answer(seen, calls);
    if (reply instanceof Error) return Promise.reject(reply);

    const response = {
      status: reply.status,
      statusText: "",
      data: reply.data ?? {},
      headers: new AxiosHeaders(),
      config,
    };
    if (reply.status >= 400) {
      return Promise.reject(new AxiosError("failed", "ERR_BAD_RESPONSE", config, null, response));
    }
    return Promise.resolve(response);
  };

  return { ...authOver(adapter, userId, options), calls };
}
