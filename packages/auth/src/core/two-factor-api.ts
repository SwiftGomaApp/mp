import type { AuthContext } from "./context";
import { applySessionAnswer, isRecord, unexpectedAnswer } from "./answers";
import { createNotAuthenticatedError, isApiError } from "./errors";
import type { AuthUser } from "./types";

/** An app code (6 digits) or a backup code, never both. */
export type SecondFactor =
  { code: string; backupCode?: never } | { backupCode: string; code?: never };

/** What the app shows so the user can add the account to an authenticator app. */
export interface TwoFactorSetup {
  /** The key to type in by hand. */
  secret: string;
  /** The `otpauth://` address, for a QR code. */
  otpauthUri: string;
}

export interface TwoFactorEnrollApi {
  /** Starts the first-time setup that staff accounts must finish before they can sign in. */
  start(): Promise<TwoFactorSetup>;
  /**
   * Confirms the first code of the authenticator app. The sign-in ends here and the answer
   * carries the backup codes, which the server shows only once.
   */
  confirm(input: {
    code: string;
  }): Promise<{ user: AuthUser; isNewDevice: boolean; backupCodes: string[] }>;
}

export interface TwoFactorApi {
  /** The second step of a sign-in that answered `twoFactorRequired`. */
  verify(input: SecondFactor): Promise<{ user: AuthUser; isNewDevice: boolean }>;
  enroll: TwoFactorEnrollApi;
}

export function createTwoFactorApi(ctx: AuthContext): TwoFactorApi {
  // The token is kept for a few minutes. Without it the user has to start the sign-in again.
  const challengeToken = (): string => {
    const token = ctx.challenge.get();
    if (!token) throw createNotAuthenticatedError();
    return token;
  };

  // The server tells when the sign-in ran out: drop the token so the app starts over.
  const dropExpired = (error: unknown): void => {
    if (isApiError(error) && error.code === "TWO_FACTOR_CHALLENGE_EXPIRED") ctx.challenge.clear();
  };

  return {
    async verify(input): Promise<{ user: AuthUser; isNewDevice: boolean }> {
      const token = challengeToken();
      try {
        const response = await ctx.client.post<unknown>("/auth/2fa/verify", {
          challengeToken: token,
          ...input,
        });
        const { user, isNewDevice } = await applySessionAnswer(ctx, response);
        return { user, isNewDevice };
      } catch (error) {
        dropExpired(error);
        throw error;
      }
    },

    enroll: {
      async start(): Promise<TwoFactorSetup> {
        const token = challengeToken();
        try {
          const response = await ctx.client.post<unknown>("/auth/2fa/enroll/setup", {
            challengeToken: token,
          });
          const data = response.data;
          if (
            !isRecord(data) ||
            typeof data.secret !== "string" ||
            typeof data.otpauthUri !== "string"
          ) {
            throw unexpectedAnswer(response);
          }
          return { secret: data.secret, otpauthUri: data.otpauthUri };
        } catch (error) {
          dropExpired(error);
          throw error;
        }
      },

      async confirm(
        input,
      ): Promise<{ user: AuthUser; isNewDevice: boolean; backupCodes: string[] }> {
        const token = challengeToken();
        try {
          const response = await ctx.client.post<unknown>("/auth/2fa/enroll/confirm", {
            challengeToken: token,
            code: input.code,
          });
          const { user, isNewDevice, backupCodes } = await applySessionAnswer(ctx, response);
          return { user, isNewDevice, backupCodes: backupCodes ?? [] };
        } catch (error) {
          dropExpired(error);
          throw error;
        }
      },
    },
  };
}
