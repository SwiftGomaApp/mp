import type { AxiosResponse } from "axios";
import type { AuthContext } from "./context";
import { createApiError } from "./errors";
import type { ApiError } from "./errors";
import type { AuthUser, LoginResult } from "./types";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The server answered 2xx with something this package does not understand. */
export function unexpectedAnswer(response: AxiosResponse<unknown>): ApiError {
  return createApiError({ status: response.status, body: response.data });
}

function positiveNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

export interface SessionAnswer {
  user: AuthUser;
  isNewDevice: boolean;
  /** Only when the answer comes from the first two-step enrollment. */
  backupCodes?: string[];
}

/**
 * Reads an answer that opens a session (sign-up, sign-in, enrollment) and puts it in the store.
 * A phone gets its tokens in the body, a browser gets cookies and only the user.
 */
export async function applySessionAnswer(
  ctx: AuthContext,
  response: AxiosResponse<unknown>,
): Promise<SessionAnswer> {
  const data = response.data;
  if (!isRecord(data) || !isRecord(data.user) || typeof data.user.id !== "string") {
    throw unexpectedAnswer(response);
  }
  const user = data.user as unknown as AuthUser;
  const expiresIn = positiveNumber(data.expiresIn);

  if (ctx.adapter.platform === "WEB") {
    await ctx.store.signIn(user);
    if (expiresIn !== undefined) ctx.store.setAccessExpiresIn(expiresIn);
  } else {
    if (typeof data.accessToken !== "string" || typeof data.refreshToken !== "string") {
      throw unexpectedAnswer(response);
    }
    await ctx.store.signIn(user, {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
      expiresInSeconds: expiresIn,
    });
  }
  ctx.challenge.clear();

  const answer: SessionAnswer = { user, isNewDevice: data.isNewDevice === true };
  if (Array.isArray(data.backupCodes)) {
    answer.backupCodes = data.backupCodes.filter((c): c is string => typeof c === "string");
  }
  return answer;
}

/** Sends a sign-in request with the device and reads the answer. */
export async function postSignIn(
  ctx: AuthContext,
  path: string,
  body: object,
): Promise<LoginResult> {
  const device = await ctx.device.get();
  return applyLoginAnswer(ctx, await ctx.client.post<unknown>(path, { ...body, device }));
}

/**
 * Reads the answer to a sign-in step. Either the session is open, or the server wants a second
 * step (HTTP 202) and its token is kept here until the app finishes it.
 */
export async function applyLoginAnswer(
  ctx: AuthContext,
  response: AxiosResponse<unknown>,
): Promise<LoginResult> {
  const data = response.data;
  if (response.status === 202) {
    if (
      !isRecord(data) ||
      data.twoFactorRequired !== true ||
      typeof data.challengeToken !== "string"
    ) {
      throw unexpectedAnswer(response);
    }
    const expiresInSeconds = positiveNumber(data.expiresIn) ?? 300;
    ctx.challenge.set(data.challengeToken, expiresInSeconds);
    return {
      status: data.enrollment === true ? "twoFactorEnrollmentRequired" : "twoFactorRequired",
      expiresInSeconds,
    };
  }

  const { user, isNewDevice } = await applySessionAnswer(ctx, response);
  return { status: "authenticated", user, isNewDevice };
}
