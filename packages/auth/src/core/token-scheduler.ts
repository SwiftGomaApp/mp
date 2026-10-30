import type { AuthAdapter } from "./adapter";
import { createSafeLogger } from "./log";
import type { AuthLogger } from "./log";
import type { RefreshManager } from "./refresh-manager";
import type { SessionStore } from "./session-store";

const MAX_TIMER_MS = 2_147_483_647;

export interface TokenSchedulerOptions {
  store: SessionStore;
  refresh: Pick<RefreshManager, "refreshNow">;
  onForeground?: AuthAdapter["onForeground"];
  marginSeconds?: number;
  jitterSeconds?: number;
  minValiditySeconds?: number;
  minIntervalSeconds?: number;
  retryDelaysSeconds?: readonly number[];
  now?: () => number;
  random?: () => number;
  log?: AuthLogger;
}

export interface TokenScheduler {
  start(): void;
  stop(): void;
  getAccessToken(): Promise<string | null>;
  refreshIfNeeded(): Promise<void>;
}

export function createTokenScheduler(options: TokenSchedulerOptions): TokenScheduler {
  const { store, refresh } = options;
  const marginMs = (options.marginSeconds ?? 300) * 1000;
  const jitterMs = (options.jitterSeconds ?? 30) * 1000;
  const minValidityMs = (options.minValiditySeconds ?? 30) * 1000;
  const minIntervalMs = (options.minIntervalSeconds ?? 10) * 1000;
  const retryDelays = options.retryDelaysSeconds?.length
    ? options.retryDelaysSeconds
    : [5, 15, 30, 60];
  const now = options.now ?? Date.now;
  const random = options.random ?? Math.random;
  const log = createSafeLogger(options.log);

  let running = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let stopWatching: (() => void) | null = null;
  let stopForeground: (() => void) | null = null;
  let lastSuccessAt = Number.NEGATIVE_INFINITY;
  let retryNotBefore = 0;
  let failures = 0;

  const hasSession = (): boolean =>
    store.getState().status === "authenticated" || store.getRefreshToken() !== null;

  const dueAt = (): number | null => {
    const expiresAt = store.getState().accessExpiresAt;
    return expiresAt === null ? null : expiresAt - marginMs;
  };

  const notBefore = (): number => Math.max(lastSuccessAt + minIntervalMs, retryNotBefore);

  function clearTimer(): void {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  }

  async function doRefresh(): Promise<void> {
    try {
      await refresh.refreshNow();
      failures = 0;
      retryNotBefore = 0;
      lastSuccessAt = now();
    } catch (error) {
      if (hasSession()) {
        const wait = retryDelays[Math.min(failures, retryDelays.length - 1)] ?? 300;
        failures += 1;
        retryNotBefore = now() + wait * 1000;
        log({ level: "warn", name: "token.retry", detail: { afterSeconds: wait } });
      }
      throw error;
    } finally {
      schedule();
    }
  }

  function fire(): void {
    timer = null;
    const due = dueAt();
    if (due !== null && due - now() > jitterMs) {
      schedule();
      return;
    }
    doRefresh().catch(() => undefined);
  }

  function schedule(): void {
    clearTimer();
    if (!running || !hasSession()) return;
    const due = dueAt();
    if (due === null) return;

    const early = random() * jitterMs;
    const delay = Math.max(due - early - now(), notBefore() - now(), 0);
    timer = setTimeout(fire, Math.min(delay, MAX_TIMER_MS));
    log({
      level: "debug",
      name: "token.scheduled",
      detail: { inSeconds: Math.round(delay / 1000) },
    });
  }

  async function refreshIfNeeded(): Promise<void> {
    const due = dueAt();
    if (!hasSession() || due === null || now() < due || now() < notBefore()) return;
    await doRefresh();
  }

  return {
    start(): void {
      if (running) return;
      running = true;
      stopWatching = store.subscribe(schedule);
      stopForeground =
        options.onForeground?.(() => {
          refreshIfNeeded().catch(() => undefined);
        }) ?? null;
      schedule();
    },

    stop(): void {
      running = false;
      clearTimer();
      stopWatching?.();
      stopForeground?.();
      stopWatching = null;
      stopForeground = null;
    },

    async getAccessToken(): Promise<string | null> {
      const token = store.getAccessToken();
      const expiresAt = store.getState().accessExpiresAt;
      const expiring = expiresAt !== null && expiresAt - now() <= minValidityMs;

      if ((token === null || expiring) && store.getRefreshToken() !== null) {
        const stillWorks = token !== null && expiresAt !== null && expiresAt > now();
        if (stillWorks && now() < retryNotBefore) return token;

        try {
          await doRefresh();
        } catch (error) {
          if (!stillWorks) throw error;
          return token;
        }
        return store.getAccessToken();
      }
      return token;
    },

    refreshIfNeeded,
  };
}
