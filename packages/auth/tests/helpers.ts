import { AxiosError, AxiosHeaders } from "axios";
import type { AxiosAdapter, InternalAxiosRequestConfig } from "axios";
import { createAuth, createMemoryStorage } from "../src/index";
import type { Auth, CreateAuthOptions, KeyValueStorage, Platform } from "../src/index";

export type Reply = { status: number; data?: unknown } | Error;

/** What the fake server saw of one request. */
export interface Seen {
  method: string;
  url: string;
  auth: string | undefined;
  body: any;
  withCredentials: boolean;
}

export const ok = (data: unknown = {}): Reply => ({ status: 200, data });

export const fail = (status: number, code: string, extra: object = {}): Reply => ({
  status,
  data: { error: { code, message: code, ...extra } },
});

export const rotated = (n: number): Reply => ({
  status: 200,
  data: { accessToken: `access-${n}`, refreshToken: `refresh-${n}`, expiresIn: 900 },
});

export const USER = {
  id: "u1",
  name: "Gael",
  email: "gael@example.com",
  phone: null,
  role: "BUYER",
  status: "ACTIVE",
};

/** A tiny server: `answer` decides each reply from what was sent. */
export function fakeServer(answer: (seen: Seen, calls: Seen[]) => Reply): {
  transport: AxiosAdapter;
  calls: Seen[];
} {
  const calls: Seen[] = [];
  const transport: AxiosAdapter = (config: InternalAxiosRequestConfig) => {
    const seen: Seen = {
      method: String(config.method),
      url: String(config.url),
      auth: config.headers.get("Authorization")?.toString(),
      body: typeof config.data === "string" ? JSON.parse(config.data) : config.data,
      withCredentials: Boolean(config.withCredentials),
    };
    calls.push(seen);
    const reply = answer(seen, calls);
    if (reply instanceof Error) {
      return Promise.reject(new AxiosError(reply.message, "ERR_NETWORK", config));
    }
    const response = {
      status: reply.status,
      statusText: "",
      data: reply.data,
      headers: new AxiosHeaders(),
      config,
    };
    if (reply.status < 300) return Promise.resolve(response);
    return Promise.reject(
      new AxiosError("failed", "ERR_BAD_RESPONSE", config, undefined, response),
    );
  };
  return { transport, calls };
}

export interface Harness {
  auth: Auth;
  calls: Seen[];
  storage: KeyValueStorage;
}

/** An `Auth` talking to the fake server, on a phone or in a browser. */
export function makeAuth(
  platform: Platform,
  answer: (seen: Seen, calls: Seen[]) => Reply,
  storageValues: Record<string, string> = {},
  extra: Pick<CreateAuthOptions, "socials" | "passkeys"> = {},
): Harness {
  const { transport, calls } = fakeServer(answer);
  const storage = createMemoryStorage(storageValues);
  const auth = createAuth({
    baseUrl: "https://api.example.com",
    adapter: {
      platform,
      storage,
      getDeviceName: () => "Test device",
      randomId: () => "device-id-0001",
    },
    transport,
    ...extra,
  });
  return { auth, calls, storage };
}

/** The tokens a phone keeps after signing in once. */
export const savedPhoneSession = (expiresAt: number): Record<string, string> => ({
  "swiftgoma-mp-auth.refreshToken": "refresh-1",
  "swiftgoma-mp-auth.accessToken": JSON.stringify({ token: "access-1", expiresAt }),
});
