import type { AuthContext } from "./context";
import type { SelfSignupRole } from "./constants";
import { isRecord, postSignIn, unexpectedAnswer } from "./answers";
import { createSocialLoginDisabledError } from "./errors";
import type { LoginResult } from "./types";

/**
 * Gets an ID token from Google or Apple. The app builds it with the provider library and its
 * own client IDs; the package hands it the one-time `nonce` the token must carry.
 */
export interface SocialProvider {
  getIdToken(nonce: string): Promise<string>;
}

export interface SocialProviders {
  google?: SocialProvider;
  apple?: SocialProvider;
}

export interface SocialSignupInput {
  role: SelfSignupRole;
  acceptTerms: true;
  confirmAge: true;
}

export interface AppleSignupInput extends SocialSignupInput {
  /** Apple gives the name only the first time, so the app passes it here. */
  name?: string;
}

export interface SocialLoginApi {
  /** Signs in with a Google account that is already registered. */
  google(): Promise<LoginResult>;
  /** Signs in with an Apple account that is already registered. */
  apple(): Promise<LoginResult>;
}

export interface SocialSignupApi {
  google(input: SocialSignupInput): Promise<LoginResult>;
  apple(input: AppleSignupInput): Promise<LoginResult>;
}

export interface SocialsApi {
  /** Which providers the app gave to the package. */
  enabled: { google: boolean; apple: boolean };
}

type ProviderName = "google" | "apple";

export function createSocialApi(ctx: AuthContext): {
  login: SocialLoginApi;
  signup: SocialSignupApi;
  socials: SocialsApi;
} {
  // The nonce ties the ID token to this attempt: fetch one, give it to the provider, send both.
  const credentialFor = async (name: ProviderName): Promise<{ idToken: string; nonce: string }> => {
    const provider = ctx.socials[name];
    if (!provider) throw createSocialLoginDisabledError(name);

    const response = await ctx.client.post<unknown>("/auth/oauth/nonce");
    const data = response.data;
    if (!isRecord(data) || typeof data.nonce !== "string") throw unexpectedAnswer(response);

    const idToken = await provider.getIdToken(data.nonce);
    if (typeof idToken !== "string" || !idToken) {
      throw new TypeError(`swiftgoma-mp-auth: the ${name} provider returned no ID token`);
    }
    return { idToken, nonce: data.nonce };
  };

  const login = async (name: ProviderName): Promise<LoginResult> =>
    postSignIn(ctx, `/auth/login/${name}`, await credentialFor(name));

  const signup = async (name: ProviderName, input: object): Promise<LoginResult> =>
    postSignIn(ctx, `/auth/signup/${name}`, { ...(await credentialFor(name)), ...input });

  return {
    login: { google: () => login("google"), apple: () => login("apple") },
    signup: {
      google: (input) => signup("google", input),
      apple: (input) => signup("apple", input),
    },
    socials: {
      enabled: { google: Boolean(ctx.socials.google), apple: Boolean(ctx.socials.apple) },
    },
  };
}
