import type { AxiosInstance } from "axios";
import { createAccount, type AccountApi } from "./account";
import { ChallengeStore } from "./challenge";
import { resolveConfig, type AuthConfig } from "./config";
import { AUTH_ENDPOINTS, ERROR_CODES } from "./constants";
import { skipAuth, type FlowContext } from "./context";
import { UnauthorizedError } from "./errors";
import { createHttpClient } from "./http";
import { createLogin, type LoginApi } from "./login";
import { parseRefresh, unexpectedResponse } from "./mapping";
import {
  SessionManager,
  type RefreshCall,
  type SessionListener,
  type SessionState,
} from "./session";
import { createSignup, type SignupApi } from "./signup";
import { createTwoFactor, type TwoFactorApi } from "./twoFactor";
import { createSocials, type SocialsApi } from "./social";

export interface AuthSession {
  readonly state: SessionState;
  start(): Promise<SessionState>;
  subscribe(listener: SessionListener): () => void;
  refresh(): Promise<void>;
  getAccessToken(): Promise<string | null>;
}

export interface Auth extends AccountApi {
  signup: SignupApi;
  login: LoginApi;
  session: AuthSession;
  socials: SocialsApi;
  twoFactor: TwoFactorApi;
  api: AxiosInstance;
  destroy(): void;
}

export function createAuth(input: AuthConfig): Auth {
  const config = resolveConfig(input);
  const bearer = config.adapter.transport === "bearer";

  const refreshCall: RefreshCall = async (refreshToken) => {
    if (bearer && !refreshToken) {
      throw new UnauthorizedError({
        message: "Session expirée, veuillez vous reconnecter",
        code: ERROR_CODES.REFRESH_TOKEN_MISSING,
        status: 401,
      });
    }

    const response = await api.post(
      AUTH_ENDPOINTS.refresh,
      bearer ? { refreshToken } : {},
      skipAuth(),
    );
    const result = parseRefresh(response.data);
    if (bearer && (!result.accessToken || !result.refreshToken)) throw unexpectedResponse();
    return result;
  };

  const session = new SessionManager({ config, refreshCall });
  const api = createHttpClient({
    config,
    getAccessToken: () => session.getAccessToken(),
    recoverFromUnauthorized: (context) => session.recoverFromUnauthorized(context),
  });

  const ctx: FlowContext = {
    config,
    api,
    session,
    challenges: new ChallengeStore(config.now),
  };

  return {
    signup: createSignup(ctx),
    login: createLogin(ctx),
    twoFactor: createTwoFactor(ctx),
    socials: createSocials(config),
    ...createAccount(ctx),
    session: {
      get state() {
        return session.state;
      },
      start: () => session.start(),
      subscribe: (listener) => session.subscribe(listener),
      refresh: () => session.refresh(),
      getAccessToken: () => session.getAccessToken(),
    },
    api,
    destroy: () => {
      session.destroy();
      ctx.challenges.clear();
    },
  };
}
