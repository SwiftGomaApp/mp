import type { ResolvedAuthConfig } from "./config";
import {
  AUTH_ENDPOINTS,
  PLATFORMS,
  SOCIAL_PROVIDERS,
  type SelfSignupRole,
  type SocialProvider,
} from "./constants";
import { completeLogin, deviceBody, skipAuth, type FlowContext } from "./context";
import { SocialLoginDisabledError } from "./errors";
import { parseLogin, parseNonce } from "./mapping";
import type { LoginResult } from "./types";

export type IdTokenProvider = (nonce: string) => Promise<string>;

export interface SocialLoginInput {
  getIdToken: IdTokenProvider;
}

export interface SocialSignupInput extends SocialLoginInput {
  role: SelfSignupRole;
  acceptTerms: true;
  confirmAge: true;
}

export interface AppleSignupInput extends SocialSignupInput {
  name?: string;
}

export interface SocialsApi {
  readonly enabled: readonly SocialProvider[];
}

const LOGIN_PATHS = {
  google: AUTH_ENDPOINTS.loginGoogle,
  apple: AUTH_ENDPOINTS.loginApple,
} as const;

const SIGNUP_PATHS = {
  google: AUTH_ENDPOINTS.signupGoogle,
  apple: AUTH_ENDPOINTS.signupApple,
} as const;

export function createSocials(config: ResolvedAuthConfig): SocialsApi {
  const { socials, adapter, logger } = config;

  if (adapter.platform === PLATFORMS.IOS && socials.google && !socials.apple) {
    logger.warn(
      "Google sign-in is on for an iOS build without Apple. App Store guideline 4.8 asks for an " +
        "equivalent login option that limits data to name and e-mail, can hide the e-mail and does " +
        "not track for advertising; Sign in with Apple is the usual choice. Ignore this if the " +
        "guideline's exceptions apply to your app.",
    );
  }

  return Object.freeze({
    enabled: Object.freeze(SOCIAL_PROVIDERS.filter((provider) => socials[provider])),
  });
}

async function socialRequest(
  ctx: FlowContext,
  provider: SocialProvider,
  path: string,
  extra: Record<string, unknown>,
  getIdToken: IdTokenProvider,
): Promise<LoginResult> {
  if (!ctx.config.socials[provider]) throw new SocialLoginDisabledError(provider);

  const nonceResponse = await ctx.api.post(AUTH_ENDPOINTS.oauthNonce, undefined, skipAuth());
  const nonce = parseNonce(nonceResponse.data);

  const idToken = await getIdToken(nonce);
  if (typeof idToken !== "string" || idToken.trim() === "") {
    throw new TypeError("getIdToken must resolve to the provider's ID token");
  }

  const device = await deviceBody(ctx);
  const response = await ctx.api.post(
    path,
    { idToken: idToken.trim(), nonce, ...extra, device },
    skipAuth(),
  );
  return completeLogin(ctx, parseLogin(response.data));
}

export function socialLogin(
  ctx: FlowContext,
  provider: SocialProvider,
  input: SocialLoginInput,
): Promise<LoginResult> {
  return socialRequest(ctx, provider, LOGIN_PATHS[provider], {}, input.getIdToken);
}

export function socialSignup(
  ctx: FlowContext,
  provider: SocialProvider,
  input: AppleSignupInput,
): Promise<LoginResult> {
  const name = provider === "apple" ? input.name?.trim() : undefined;
  const extra = {
    role: input.role,
    acceptTerms: input.acceptTerms,
    confirmAge: input.confirmAge,
    ...(name ? { name } : {}),
  };
  return socialRequest(ctx, provider, SIGNUP_PATHS[provider], extra, input.getIdToken);
}
