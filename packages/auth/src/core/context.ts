import type { AxiosInstance } from "axios";
import type { ChallengeStore } from "./challenge";
import type { ResolvedAuthConfig } from "./config";
import type { AuthRequestConfig } from "./http";
import { unexpectedResponse, type ParsedLogin } from "./mapping";
import type { SessionManager, StartSessionInput } from "./session";
import type { LoginResult } from "./types";

export interface FlowContext {
  config: ResolvedAuthConfig;
  api: AxiosInstance;
  session: SessionManager;
  challenges: ChallengeStore;
}

export function skipAuth(): AuthRequestConfig {
  return { skipAuth: true };
}

export async function deviceBody(ctx: FlowContext) {
  const { adapter } = ctx.config;
  const info = await adapter.getDeviceInfo();
  return {
    deviceId: info.deviceId,
    ...(info.deviceName ? { deviceName: info.deviceName } : {}),
    platform: adapter.platform,
  };
}

export async function openSession(ctx: FlowContext, tokens: StartSessionInput): Promise<void> {
  if (ctx.config.adapter.transport === "bearer" && (!tokens.accessToken || !tokens.refreshToken)) {
    throw unexpectedResponse();
  }
  await ctx.session.startSession(tokens);
}

export async function completeLogin(ctx: FlowContext, parsed: ParsedLogin): Promise<LoginResult> {
  if (parsed.kind === "challenge") {
    ctx.challenges.set(parsed.token, parsed.enrollment ? "enroll" : "verify", parsed.expiresIn);
    return {
      status: parsed.enrollment ? "two_factor_enrollment_required" : "two_factor_required",
      challengeExpiresIn: parsed.expiresIn,
    };
  }

  await openSession(ctx, parsed.tokens);
  ctx.challenges.clear();
  return { status: "authenticated", user: parsed.user, isNewDevice: parsed.isNewDevice };
}
