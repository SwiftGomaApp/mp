import type { AxiosInstance } from "axios";
import { createAuthContext } from "./context";
import type { CreateAuthOptions } from "./context";
import type { DeviceIdentity } from "./device";
import { createLoginApi } from "./login-api";
import type { LoginApi } from "./login-api";
import type { SessionState } from "./session-store";
import { createSessionApi } from "./session-api";
import type { SessionApi } from "./session-api";
import { createPasskeyLoginApi } from "./passkey-api";
import type { PasskeyLoginApi } from "./passkey-api";
import { createPasswordApi } from "./password-api";
import type { PasswordApi } from "./password-api";
import { createSignupApi } from "./signup-api";
import { createSocialApi } from "./social-api";
import type { SocialLoginApi, SocialSignupApi, SocialsApi } from "./social-api";
import type { SignupApi } from "./signup-api";
import { createStepUpApi } from "./step-up-api";
import type { StepUpApi } from "./step-up-api";
import { createTwoFactorApi } from "./two-factor-api";
import type { TwoFactorApi } from "./two-factor-api";
import type { AuthUser } from "./types";

export type { CreateAuthOptions } from "./context";

export interface AuthSession {
  getState(): SessionState<AuthUser>;
  /** Calls the listener after every change of the session. Returns a function that stops it. */
  subscribe(listener: (state: SessionState<AuthUser>) => void): () => void;
  /**
   * The access token to send with a request, refreshed first if it is about to expire.
   * `null` in a browser (cookies carry the session) or when nobody is signed in.
   * For libraries that need the token themselves, such as a realtime connection.
   */
  getAccessToken(): Promise<string | null>;
  /**
   * Calls the listener with the new access token each time it changes, and with `null` when the
   * session ends. A realtime connection reconnects with it.
   */
  onTokenRefreshed(listener: (accessToken: string | null) => void): () => void;
  /** Gets a new access token now. Rejects with an `ApiError` if it fails. */
  refreshNow(): Promise<void>;
  /** Calls the listener, with the error code, when the server ends the session. */
  onSessionEnded(listener: (reason: string) => void): () => void;
}

export interface Auth extends Pick<SessionApi, "me" | "logout" | "logoutAll" | "devices"> {
  /** The Axios client, ready to use: tokens are sent and renewed for you. */
  api: AxiosInstance;
  session: AuthSession;
  signup: SignupApi & SocialSignupApi;
  login: LoginApi & SocialLoginApi & PasskeyLoginApi;
  socials: SocialsApi;
  twoFactor: TwoFactorApi;
  stepUp: StepUpApi;
  password: PasswordApi;
  /** The id, name and platform this device presents to the server. */
  device: DeviceIdentity;
  /**
   * Reads the session kept from the last run and starts renewing tokens in the background.
   * Call it once when the app starts. If storage cannot be read it throws, and can be called
   * again to retry.
   */
  start(): Promise<void>;
  /** Stops the background renewal. */
  stop(): void;
}

export function createAuth(options: CreateAuthOptions): Auth {
  const ctx = createAuthContext(options);
  const { client, store, device, refresh, scheduler } = ctx;
  const sessionApi = createSessionApi(ctx);
  const social = createSocialApi(ctx);
  let starting: Promise<void> | null = null;
  let stopWatchingTabs: (() => void) | null = null;

  return {
    api: client,
    device,
    signup: { ...createSignupApi(ctx), ...social.signup },
    login: { ...createLoginApi(ctx), ...social.login, ...createPasskeyLoginApi(ctx) },
    socials: social.socials,
    twoFactor: createTwoFactorApi(ctx),
    stepUp: createStepUpApi(ctx),
    password: createPasswordApi(ctx),
    me: sessionApi.me,
    logout: sessionApi.logout,
    logoutAll: sessionApi.logoutAll,
    devices: sessionApi.devices,

    session: {
      getState: () => store.getState(),
      subscribe: (listener) => store.subscribe(listener),
      getAccessToken: () => scheduler.getAccessToken(),
      onTokenRefreshed: (listener) => store.onAccessTokenChange(listener),
      refreshNow: () => refresh.refreshNow(),
      onSessionEnded: (listener) => refresh.onSessionEnded(listener),
    },

    start(): Promise<void> {
      starting ??= store
        .hydrate()
        .then(() => {
          stopWatchingTabs ??= refresh.watchOtherTabs();
          scheduler.start();
        })
        .catch((error: unknown) => {
          starting = null;
          throw error;
        });
      return starting;
    },

    stop(): void {
      scheduler.stop();
      stopWatchingTabs?.();
      stopWatchingTabs = null;
      starting = null;
    },
  };
}
