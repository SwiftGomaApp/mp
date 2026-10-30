import axios from "axios";
import type { AxiosInstance, InternalAxiosRequestConfig } from "axios";
import type { Platform } from "./constants";
import { isApiError } from "./errors";
import { createSafeLogger } from "./log";
import type { AuthLogger } from "./log";
import { REFRESH_PATH } from "./refresh-manager";
import type { RefreshManager } from "./refresh-manager";
import type { SessionStore } from "./session-store";
import type { TokenScheduler } from "./token-scheduler";

export interface AuthInterceptorOptions {
  store: SessionStore;
  platform: Platform;
  log?: AuthLogger;
  tokens: Pick<TokenScheduler, "getAccessToken">;
  refresh: Pick<RefreshManager, "refreshNow">;
}

const EXPIRED_CODES: ReadonlySet<string> = new Set(["TOKEN_EXPIRED", "UNAUTHORIZED"]);

interface TrackedConfig extends InternalAxiosRequestConfig {
  swiftgomaToken?: string;
  swiftgomaRetried?: boolean;
}

function isRefreshCall(config: { url?: string }): boolean {
  return (config.url ?? "").split("?")[0] === REFRESH_PATH;
}

export function attachAuth(client: AxiosInstance, options: AuthInterceptorOptions): () => void {
  const { store, platform, tokens, refresh } = options;
  const log = createSafeLogger(options.log);

  const onRequest = client.interceptors.request.use(async (config) => {
    if (isRefreshCall(config) || config.headers.has("Authorization")) return config;

    const token = await tokens.getAccessToken();
    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
      (config as TrackedConfig).swiftgomaToken = token;
    }
    return config;
  });

  const onResponse = client.interceptors.response.use(undefined, async (error: unknown) => {
    if (!isApiError(error) || error.status !== 401 || !EXPIRED_CODES.has(error.code)) throw error;

    const cause = error.cause;
    if (!axios.isAxiosError(cause) || !cause.config) throw error;
    const config = cause.config as TrackedConfig;

    // A browser cannot see its refresh cookie: until the server says otherwise, assume there is one.
    const hasSession =
      platform === "WEB"
        ? store.getState().status !== "anonymous"
        : store.getRefreshToken() !== null;
    if (config.swiftgomaRetried || isRefreshCall(config) || !hasSession) throw error;
    config.swiftgomaRetried = true;
    log({
      level: "debug",
      name: "request.retried",
      detail: { path: (config.url ?? "").split("?")[0] ?? "", code: error.code },
    });

    const renewed =
      config.swiftgomaToken !== undefined && store.getAccessToken() !== config.swiftgomaToken;
    if (!renewed) await refresh.refreshNow();

    if (config.swiftgomaToken !== undefined) {
      config.headers.delete("Authorization");
      config.swiftgomaToken = undefined;
    }
    return client.request(config);
  });

  return () => {
    client.interceptors.request.eject(onRequest);
    client.interceptors.response.eject(onResponse);
  };
}
