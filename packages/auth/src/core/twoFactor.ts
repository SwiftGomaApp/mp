import { AUTH_ENDPOINTS, ERROR_CODES } from "./constants";
import { completeLogin, skipAuth, type FlowContext } from "./context";
import type { ChallengeKind } from "./challenge";
import { ApiError, isApiError } from "./errors";
import {
  parseEnrollment,
  parseTwoFactorSetup,
  parseVerifiedLogin,
  unexpectedResponse,
} from "./mapping";
import type { EnrollmentResult, LoginResult, TwoFactorSetup } from "./types";

export type AuthenticatedLogin = Extract<LoginResult, { status: "authenticated" }>;

export type TwoFactorVerifyInput =
  { code: string; backupCode?: never } | { backupCode: string; code?: never };

export interface TwoFactorConfirmInput {
  code: string;
}

export interface TwoFactorApi {
  verify(input: TwoFactorVerifyInput): Promise<AuthenticatedLogin>;
  enroll: {
    start(): Promise<TwoFactorSetup>;
    confirm(input: TwoFactorConfirmInput): Promise<EnrollmentResult>;
  };
}

function requireChallenge(ctx: FlowContext, kind: ChallengeKind): string {
  const challenge = ctx.challenges.get();
  if (!challenge) {
    throw new ApiError({
      message: "La vérification a expiré, veuillez vous reconnecter",
      code: ERROR_CODES.TWO_FACTOR_CHALLENGE_EXPIRED,
    });
  }

  if (challenge.kind !== kind) {
    throw new ApiError(
      kind === "verify"
        ? {
            message: "Vous devez d'abord configurer la double vérification",
            code: ERROR_CODES.TWO_FACTOR_SETUP_REQUIRED,
          }
        : {
            message: "La double vérification est déjà activée sur ce compte",
            code: ERROR_CODES.TWO_FACTOR_ALREADY_ENABLED,
          },
    );
  }

  return challenge.token;
}

async function guarded<T>(ctx: FlowContext, task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (isApiError(error) && error.code === ERROR_CODES.TWO_FACTOR_CHALLENGE_EXPIRED) {
      ctx.challenges.clear();
    }
    throw error;
  }
}

export function createTwoFactor(ctx: FlowContext): TwoFactorApi {
  return {
    verify: (input) =>
      guarded(ctx, async () => {
        const challengeToken = requireChallenge(ctx, "verify");
        const factor =
          input.code !== undefined
            ? { code: input.code.trim() }
            : { backupCode: (input.backupCode ?? "").trim() };

        const response = await ctx.api.post(
          AUTH_ENDPOINTS.twoFactorVerify,
          { challengeToken, ...factor },
          skipAuth(),
        );

        const result = await completeLogin(ctx, parseVerifiedLogin(response.data));
        if (result.status !== "authenticated") throw unexpectedResponse();
        return result;
      }),

    enroll: {
      start: () =>
        guarded(ctx, async () => {
          const challengeToken = requireChallenge(ctx, "enroll");
          const response = await ctx.api.post(
            AUTH_ENDPOINTS.twoFactorEnrollSetup,
            { challengeToken },
            skipAuth(),
          );
          return parseTwoFactorSetup(response.data);
        }),

      confirm: ({ code }) =>
        guarded(ctx, async () => {
          const challengeToken = requireChallenge(ctx, "enroll");
          const response = await ctx.api.post(
            AUTH_ENDPOINTS.twoFactorEnrollConfirm,
            { challengeToken, code: code.trim() },
            skipAuth(),
          );

          const { login, backupCodes } = parseEnrollment(response.data);
          const result = await completeLogin(ctx, login);
          if (result.status !== "authenticated") throw unexpectedResponse();
          return { user: result.user, isNewDevice: result.isNewDevice, backupCodes };
        }),
    },
  };
}
