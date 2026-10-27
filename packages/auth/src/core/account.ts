import { AUTH_ENDPOINTS } from "./constants";
import type { FlowContext } from "./context";
import { NotAuthenticatedError } from "./errors";
import { parseLogoutAll, parseMe } from "./mapping";
import type { CurrentUser, LogoutAllResult } from "./types";

export interface AccountApi {
  logout(): Promise<{ serverRevoked: boolean }>;
  logoutAll(): Promise<LogoutAllResult>;
  me(): Promise<CurrentUser>;
}

function requireSession(ctx: FlowContext): void {
  if (ctx.session.state.status === "unauthenticated") throw new NotAuthenticatedError();
}

export function createAccount(ctx: FlowContext): AccountApi {
  return {
    async logout() {
      let serverRevoked = false;

      if (ctx.session.state.status !== "unauthenticated") {
        try {
          await ctx.api.post(AUTH_ENDPOINTS.logout);
          serverRevoked = true;
        } catch (error) {
          ctx.config.logger.warn("logout request failed, signing out on this device only", error);
        }
      }

      ctx.challenges.clear();
      await ctx.session.endSession("logout");
      return { serverRevoked };
    },

    async logoutAll() {
      requireSession(ctx);
      const response = await ctx.api.post(AUTH_ENDPOINTS.logoutAll);
      const result = parseLogoutAll(response.data);

      ctx.challenges.clear();
      await ctx.session.endSession("logout");
      return result;
    },

    async me() {
      requireSession(ctx);
      const response = await ctx.api.get(AUTH_ENDPOINTS.me);
      return parseMe(response.data);
    },
  };
}
