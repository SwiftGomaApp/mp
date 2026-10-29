import type { AxiosInstance } from "axios";
import { DEFAULT_ACCESS_TTL_SECONDS } from "./constants";
import type { Platform } from "./constants";
import { createApiError, createNotAuthenticatedError, isApiError } from "./errors";
import type { ApiError } from "./errors";
import { createSafeLogger, describeError } from "./log";
import type { AuthLogger } from "./log";
import type { AuthAdapter } from "./adapter";
import type { SessionStore } from "./session-store";

export const REFRESH_PATH = "/auth/refresh";

export interface RefreshManagerOptions {
  client: AxiosInstance;
  platform: Platform;
  store: SessionStore;
  conflictRetries?: number;
  conflictDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
  log?: AuthLogger;
  tabs?: Pick<AuthAdapter, "withRefreshLock" | "announceRefresh" | "onRefreshedElsewhere">;
}

export interface RefreshManager {
  refreshNow(): Promise<void>;
  onSessionEnded(listener: (reason: string) => void): () => void;
  watchOtherTabs(): () => void;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

function isRefusal(error: ApiError): boolean {
  return error.status === 401 || error.code === "ACCOUNT_SUSPENDED";
}

function readExpiresIn(data: unknown): number | undefined {
  const value = (data as { expiresIn?: unknown } | null | undefined)?.expiresIn;
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

export function createRefreshManager(options: RefreshManagerOptions): RefreshManager {
  const { client, platform, store } = options;
  const conflictRetries = options.conflictRetries ?? 2;
  const conflictDelayMs = options.conflictDelayMs ?? 300;
  const sleep = options.sleep ?? defaultSleep;
  const usesCookies = platform === "WEB";
  const log = createSafeLogger(options.log);
  const tabs = options.tabs;
  let refreshedElsewhere = 0;
  let lastExpiresIn: number | undefined;

  const endListeners = new Set<(reason: string) => void>();
  let inFlight: Promise<void> | null = null;

  async function endSession(reason: string): Promise<void> {
    log({ level: "warn", name: "session.ended", detail: { reason } });
    await store.clear().catch(() => undefined);
    for (const listener of [...endListeners]) {
      try {
        listener(reason);
      } catch {}
    }
  }

  async function attempt(): Promise<void> {
    const sentToken = usesCookies ? null : store.getRefreshToken();
    if (!usesCookies && !sentToken) {
      await endSession("NOT_AUTHENTICATED");
      throw createNotAuthenticatedError();
    }

    try {
      const response = await client.post<unknown>(
        REFRESH_PATH,
        usesCookies ? {} : { refreshToken: sentToken },
      );
      const data = response.data as Record<string, unknown> | null | undefined;
      const expiresIn = readExpiresIn(data);

      if (usesCookies) {
        lastExpiresIn = expiresIn ?? DEFAULT_ACCESS_TTL_SECONDS;
        store.setAccessExpiresIn(lastExpiresIn);
        return;
      }
      if (typeof data?.accessToken !== "string" || typeof data.refreshToken !== "string") {
        throw createApiError({ status: response.status, body: response.data });
      }
      await store.updateTokens({
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        expiresInSeconds: expiresIn,
      });
    } catch (error) {
      const stillCurrent = usesCookies || store.getRefreshToken() === sentToken;
      if (isApiError(error) && isRefusal(error) && stillCurrent) await endSession(error.code);
      throw error;
    }
  }

  async function run(): Promise<void> {
    for (let tries = 0; ; tries += 1) {
      try {
        return await attempt();
      } catch (error) {
        const busy = isApiError(error) && error.code === "REFRESH_IN_PROGRESS";
        if (!busy || tries >= conflictRetries) throw error;
        log({ level: "debug", name: "refresh.busy", detail: { retry: tries + 1 } });
        await sleep(conflictDelayMs * (tries + 1));
      }
    }
  }

  // Tabs of one browser share the cookie: take the lock, and if another tab refreshed while this
  // one waited, use that result instead of rotating the cookie a second time.
  async function runWithTabs(): Promise<void> {
    if (!usesCookies || !tabs?.withRefreshLock) return run();
    const seenBefore = refreshedElsewhere;
    return tabs.withRefreshLock(async () => {
      if (refreshedElsewhere > seenBefore) {
        log({ level: "debug", name: "refresh.adopted" });
        return;
      }
      await run();
      if (lastExpiresIn !== undefined) tabs.announceRefresh?.(lastExpiresIn);
    });
  }

  async function logged(): Promise<void> {
    log({ level: "debug", name: "refresh.start" });
    try {
      await runWithTabs();
      log({ level: "debug", name: "refresh.ok" });
    } catch (error) {
      log({ level: "warn", name: "refresh.failed", detail: describeError(error) });
      throw error;
    }
  }

  return {
    refreshNow(): Promise<void> {
      inFlight ??= logged().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },

    onSessionEnded(listener): () => void {
      endListeners.add(listener);
      return () => void endListeners.delete(listener);
    },

    watchOtherTabs(): () => void {
      if (!usesCookies || !tabs?.onRefreshedElsewhere) return () => undefined;
      return tabs.onRefreshedElsewhere((expiresInSeconds) => {
        refreshedElsewhere += 1;
        store.setAccessExpiresIn(expiresInSeconds);
      });
    },
  };
}
