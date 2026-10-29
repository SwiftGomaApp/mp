import type { AuthContext } from "./context";
import { isRecord, postSignIn, unexpectedAnswer } from "./answers";
import { createPasskeysDisabledError } from "./errors";
import type { LoginResult } from "./types";

/** WebAuthn options and credentials as JSON, the way the server and the browser exchange them. */
export type PasskeyJson = Record<string, unknown>;

/**
 * Talks to the device (browser WebAuthn or a native library). The app builds it; the package
 * runs the server steps around it.
 */
export interface PasskeyProvider {
  /** Creates a passkey from the server options and returns the credential. */
  createCredential(options: PasskeyJson): Promise<PasskeyJson>;
  /** Signs a challenge with an existing passkey and returns the assertion. */
  getAssertion(options: PasskeyJson): Promise<PasskeyJson>;
}

export interface PasskeyLoginApi {
  /** Signs in with a passkey, without typing anything. */
  passkey(): Promise<LoginResult>;
}

export function createPasskeyLoginApi(ctx: AuthContext): PasskeyLoginApi {
  return {
    async passkey(): Promise<LoginResult> {
      const provider = ctx.passkeys;
      if (!provider) throw createPasskeysDisabledError();

      const started = await ctx.client.post<unknown>("/auth/login/passkey/options");
      const data = started.data;
      if (!isRecord(data) || typeof data.challengeId !== "string" || !isRecord(data.options)) {
        throw unexpectedAnswer(started);
      }

      const assertion = await provider.getAssertion(data.options);
      return postSignIn(ctx, "/auth/login/passkey/verify", {
        challengeId: data.challengeId,
        response: assertion,
      });
    },
  };
}
