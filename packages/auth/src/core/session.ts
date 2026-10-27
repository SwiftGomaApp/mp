import type { AxiosResponse } from "axios";
import type { ResolvedAuthConfig } from "./config";
import {
  ACCESS_TOKEN_EXPIRED_CODES,
  DEFAULT_ACCESS_TOKEN_TTL_SECONDS,
  ERROR_CODES,
  REFRESH_LOCK_NAME,
  REFRESH_RETRY_DELAYS_MS,
  SESSION_ENDED_CODES,
} from "./constants";
import { NotAuthenticatedError, isApiError } from "./errors";
import type { UnauthorizedContext } from "./http";
import { decodeJwtExpiry } from "./jwt";
import type { SessionRecord } from "./types";

export type SessionEndReason =
  "logout" | "session_expired" | "session_revoked" | "token_reused" | "account_suspended";

export type SessionState =
  | { status: "unknown" }
  | { status: "authenticated" }
  | { status: "unauthenticated"; reason?: SessionEndReason };

export type SessionListener = (state: SessionState) => void;

export interface RefreshResult {
  accessToken?: string | null | undefined;
  refreshToken?: string | null | undefined;
  expiresIn?: number | undefined;
}

export type RefreshCall = (refreshToken: string | null) => Promise<RefreshResult>;

export interface StartSessionInput {
  accessToken?: string | null | undefined;
  refreshToken?: string | null | undefined;
  expiresIn?: number | undefined;
}

export interface SessionManagerOptions {
  config: ResolvedAuthConfig;
  refreshCall: RefreshCall;
  random?: () => number;
}

const MAX_SPREAD_MS = 15_000;
const MAX_TIMER_MS = 2_147_483_647;
const RECENT_REFRESH_MS = 10_000;
const IN_PROGRESS_WAIT_MS = 1_000;
const IN_PROGRESS_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function readErrorCode(data: unknown): string | undefined {
  if (typeof data !== "object" || data === null) return undefined;
  const error = (data as { error?: unknown }).error;
  if (typeof error !== "object" || error === null) return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" && code.length > 0 ? code : undefined;
}

function endReasonFor(code: string): SessionEndReason {
  if (code === ERROR_CODES.SESSION_REVOKED) return "session_revoked";
  if (code === ERROR_CODES.TOKEN_REUSED) return "token_reused";
  if (code === ERROR_CODES.ACCOUNT_SUSPENDED) return "account_suspended";
  return "session_expired";
}

function reasonOf(state: SessionState): SessionEndReason | undefined {
  return state.status === "unauthenticated" ? state.reason : undefined;
}

export class SessionManager {
  private readonly config: ResolvedAuthConfig;
  private readonly refreshCall: RefreshCall;
  private readonly random: () => number;
  private readonly listeners = new Set<SessionListener>();
  private readonly cleanups: Array<() => void> = [];

  private record: SessionRecord | null = null;
  private current: SessionState = { status: "unknown" };
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inflight: Promise<void> | null = null;
  private generation = 0;
  private failures = 0;
  private lastRefreshAt: number | null = null;
  private started = false;

  constructor(options: SessionManagerOptions) {
    this.config = options.config;
    this.refreshCall = options.refreshCall;
    this.random = options.random ?? Math.random;
  }

  get state(): SessionState {
    return this.current;
  }

  subscribe(listener: SessionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async start(): Promise<SessionState> {
    if (this.started) return this.current;
    this.started = true;

    const { adapter } = this.config;
    this.cleanups.push(
      adapter.lifecycle.onForeground(() => {
        void this.refreshIfNeeded().catch(() => undefined);
      }),
    );
    if (adapter.store.subscribe) {
      this.cleanups.push(
        adapter.store.subscribe(() => {
          void this.syncFromStore().catch(() => undefined);
        }),
      );
    }

    const record = await adapter.store.load();
    if (!record) {
      this.setState({ status: "unauthenticated" });
      return this.current;
    }

    this.record = record;
    this.setState({ status: "authenticated" });
    this.schedule();
    await this.refreshIfNeeded().catch(() => undefined);
    return this.current;
  }

  async startSession(input: StartSessionInput): Promise<void> {
    const accessToken = input.accessToken ?? null;
    const record: SessionRecord = {
      accessToken,
      refreshToken: input.refreshToken ?? null,
      accessTokenExpiresAt: this.computeExpiry(input.expiresIn, accessToken),
    };

    this.generation += 1;
    await this.config.adapter.store.save(record);
    this.record = record;
    this.failures = 0;
    this.lastRefreshAt = null;
    this.setState({ status: "authenticated" });
    this.schedule();
  }

  async endSession(reason: SessionEndReason = "logout"): Promise<void> {
    this.drop(reason);
    await this.config.adapter.store.clear();
  }

  async getAccessToken(): Promise<string | null> {
    if (this.inflight) {
      await this.inflight.catch(() => undefined);
    } else if (this.record && this.failures === 0 && this.needsRefresh()) {
      await this.refresh().catch(() => undefined);
    }
    return this.record?.accessToken ?? null;
  }

  async refreshIfNeeded(): Promise<void> {
    if (this.current.status !== "authenticated" || !this.needsRefresh()) return;
    await this.refresh();
  }

  refresh(): Promise<void> {
    if (!this.inflight) {
      const { lock } = this.config.adapter;
      const task = lock
        ? lock.run(REFRESH_LOCK_NAME, () => this.performRefresh())
        : this.performRefresh();
      this.inflight = task.finally(() => {
        this.inflight = null;
      });
    }
    return this.inflight;
  }

  async recoverFromUnauthorized(context: UnauthorizedContext): Promise<AxiosResponse | undefined> {
    if (this.current.status !== "authenticated") return undefined;

    const code = readErrorCode(context.error.response?.data);
    const expired = code !== undefined && ACCESS_TOKEN_EXPIRED_CODES.has(code);
    const unauthorized = code === undefined || code === ERROR_CODES.UNAUTHORIZED;
    if (!expired && !unauthorized) return undefined;

    if (!this.recentlyRefreshed()) await this.refresh();
    return context.retry();
  }

  destroy(): void {
    this.cancelTimer();
    for (const cleanup of this.cleanups.splice(0)) cleanup();
    this.listeners.clear();
    this.generation += 1;
    this.started = false;
  }

  private async performRefresh(): Promise<void> {
    const { store } = this.config.adapter;
    const generation = this.generation;

    for (let attempt = 0; ; attempt += 1) {
      const stored = await store.load();
      if (generation !== this.generation) throw new NotAuthenticatedError();
      if (!stored) {
        if (this.current.status === "authenticated") this.drop("logout");
        throw new NotAuthenticatedError();
      }

      // Another tab (or a previous attempt) already renewed the session: use its result.
      if (this.canAdopt(stored)) {
        this.adopt(stored);
        return;
      }

      let result: RefreshResult;
      try {
        result = await this.refreshCall(stored.refreshToken);
      } catch (error) {
        if (generation !== this.generation) throw new NotAuthenticatedError();
        if (
          isApiError(error) &&
          error.code === ERROR_CODES.REFRESH_IN_PROGRESS &&
          attempt < IN_PROGRESS_RETRIES
        ) {
          await sleep(IN_PROGRESS_WAIT_MS);
          continue;
        }
        await this.handleRefreshFailure(error);
        throw error;
      }

      if (generation !== this.generation) throw new NotAuthenticatedError();
      await this.applyRefresh(stored, result);
      return;
    }
  }

  private async applyRefresh(previous: SessionRecord, result: RefreshResult): Promise<void> {
    const accessToken = result.accessToken ?? null;
    const record: SessionRecord = {
      accessToken,
      refreshToken: result.refreshToken ?? previous.refreshToken,
      accessTokenExpiresAt: this.computeExpiry(result.expiresIn, accessToken),
    };

    await this.config.adapter.store.save(record);
    this.record = record;
    this.failures = 0;
    this.lastRefreshAt = this.config.now();
    this.setState({ status: "authenticated" });
    this.schedule();
  }

  private async handleRefreshFailure(error: unknown): Promise<void> {
    if (isApiError(error) && SESSION_ENDED_CODES.has(error.code)) {
      await this.endSession(endReasonFor(error.code));
      return;
    }

    this.failures += 1;
    const index = Math.min(this.failures - 1, REFRESH_RETRY_DELAYS_MS.length - 1);
    const delay = REFRESH_RETRY_DELAYS_MS[index] ?? 60_000;
    this.config.logger.warn("session refresh failed, will retry", { retryInMs: delay, error });
    this.schedule(delay);
  }

  private async syncFromStore(): Promise<void> {
    const stored = await this.config.adapter.store.load();
    if (!stored) {
      if (this.current.status === "authenticated") this.drop("logout");
      return;
    }
    const known = this.record;
    if (
      !known ||
      stored.accessToken !== known.accessToken ||
      stored.accessTokenExpiresAt !== known.accessTokenExpiresAt
    ) {
      this.adopt(stored);
    }
  }

  private canAdopt(stored: SessionRecord): boolean {
    const known = this.record?.accessTokenExpiresAt ?? 0;
    const margin = this.config.refreshMarginSeconds * 1000;
    return (
      stored.accessTokenExpiresAt > known &&
      stored.accessTokenExpiresAt - this.config.now() > margin
    );
  }

  private adopt(record: SessionRecord): void {
    this.record = record;
    this.failures = 0;
    this.lastRefreshAt = this.config.now();
    this.setState({ status: "authenticated" });
    this.schedule();
  }

  private drop(reason: SessionEndReason): void {
    this.generation += 1;
    this.record = null;
    this.failures = 0;
    this.lastRefreshAt = null;
    this.cancelTimer();
    this.setState({ status: "unauthenticated", reason });
  }

  private needsRefresh(): boolean {
    if (!this.record) return false;
    const margin = this.config.refreshMarginSeconds * 1000;
    return this.record.accessTokenExpiresAt - this.config.now() <= margin;
  }

  private recentlyRefreshed(): boolean {
    return (
      this.lastRefreshAt !== null && this.config.now() - this.lastRefreshAt < RECENT_REFRESH_MS
    );
  }

  private computeExpiry(expiresIn: number | undefined, accessToken: string | null): number {
    if (typeof expiresIn === "number" && Number.isFinite(expiresIn) && expiresIn > 0) {
      return this.config.now() + expiresIn * 1000;
    }
    const fromToken = accessToken ? decodeJwtExpiry(accessToken) : null;
    if (fromToken !== null) return fromToken;
    return this.config.now() + DEFAULT_ACCESS_TOKEN_TTL_SECONDS * 1000;
  }

  private schedule(delayMs?: number): void {
    this.cancelTimer();
    if (!this.record || this.current.status !== "authenticated") return;

    const margin = this.config.refreshMarginSeconds * 1000;
    const delay =
      delayMs ??
      Math.max(
        0,
        this.record.accessTokenExpiresAt -
          this.config.now() -
          margin -
          this.random() * MAX_SPREAD_MS,
      );

    this.timer = setTimeout(
      () => {
        this.timer = null;
        this.refresh().catch(() => undefined);
      },
      Math.min(delay, MAX_TIMER_MS),
    );
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private setState(next: SessionState): void {
    if (this.current.status === next.status && reasonOf(this.current) === reasonOf(next)) return;
    this.current = next;
    for (const listener of [...this.listeners]) {
      try {
        listener(next);
      } catch (error) {
        this.config.logger.error("session listener failed", error);
      }
    }
  }
}
