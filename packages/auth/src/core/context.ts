import type { AxiosInstance, AxiosRequestConfig } from "axios";
import type { AuthAdapter } from "./adapter";
import { attachAuth } from "./auth-interceptors";
import { createChallengeHolder } from "./challenge";
import type { ChallengeHolder } from "./challenge";
import { createHttpClient } from "./client";
import { createDeviceIdentity } from "./device";
import type { DeviceIdentity } from "./device";
import { createRefreshManager } from "./refresh-manager";
import type { RefreshManager } from "./refresh-manager";
import { createSessionStore } from "./session-store";
import type { SessionStore } from "./session-store";
import { createTokenScheduler } from "./token-scheduler";
import type { TokenScheduler } from "./token-scheduler";
import type { AuthLogger } from "./log";
import type { PasskeyProvider } from "./passkey-api";
import type { SocialProviders } from "./social-api";
import type { AuthUser } from "./types";

export interface CreateAuthOptions {
  /** The API origin, for example `https://api.swiftgoma.com`. `/api/v1` is added for you. */
  baseUrl: string;
  /** `createWebAdapter()` in a browser, `createNativeAdapter(...)` in an Expo app. */
  adapter: AuthAdapter;
  /** How long to wait for an answer before giving up. Default 15000. */
  requestTimeoutMs?: number;
  /** Refresh the access token this long before it expires. Default 300 (5 minutes). */
  refreshMarginSeconds?: number;
  /** Google and Apple, built by the app with its own client IDs. Off when missing. */
  socials?: SocialProviders;
  /** WebAuthn, built by the app on the browser or a native library. Off when missing. */
  passkeys?: PasskeyProvider;
  /**
   * Called with what the package does: refreshes, retries, the end of a session. It never gets
   * a token, a code, a password or a request body.
   */
  logger?: AuthLogger;
  /** Replaces the way requests are sent. For tests. */
  transport?: AxiosRequestConfig["adapter"];
}

/** Everything the package builds, shared by the parts of the API. Not part of the public API. */
export interface AuthContext {
  adapter: AuthAdapter;
  client: AxiosInstance;
  store: SessionStore<AuthUser>;
  device: DeviceIdentity;
  refresh: RefreshManager;
  scheduler: TokenScheduler;
  /** The token of a sign-in that is waiting for its second step. */
  challenge: ChallengeHolder;
  socials: SocialProviders;
  passkeys: PasskeyProvider | undefined;
}

export function createAuthContext(options: CreateAuthOptions): AuthContext {
  const { adapter } = options;
  if (!adapter) throw new TypeError("swiftgoma-mp-auth: an adapter is required");

  const client = createHttpClient({
    baseUrl: options.baseUrl,
    timeoutMs: options.requestTimeoutMs,
    withCredentials: adapter.platform === "WEB",
    adapter: options.transport,
  });
  const store = createSessionStore<AuthUser>(adapter);
  const refresh = createRefreshManager({
    client,
    platform: adapter.platform,
    store,
    log: options.logger,
    tabs: adapter,
  });
  const scheduler = createTokenScheduler({
    store,
    refresh,
    onForeground: adapter.onForeground,
    marginSeconds: options.refreshMarginSeconds,
    log: options.logger,
  });
  attachAuth(client, {
    store,
    platform: adapter.platform,
    log: options.logger,
    tokens: scheduler,
    refresh,
  });

  return {
    adapter,
    client,
    store,
    device: createDeviceIdentity(adapter),
    refresh,
    scheduler,
    challenge: createChallengeHolder(),
    socials: options.socials ?? {},
    passkeys: options.passkeys,
  };
}
