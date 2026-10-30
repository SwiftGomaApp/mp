import type { AuthContext } from "./context";
import { isRecord, unexpectedAnswer } from "./answers";
import { isApiError } from "./errors";
import type { CurrentUser, DeviceSession } from "./types";

export interface DevicesApi {
  /** Every device signed in to the account, the one asking included. */
  list(): Promise<DeviceSession[]>;
  /** Signs a device out. If it is the current one, the local session ends too. */
  disconnect(id: string): Promise<{ current: boolean }>;
}

export interface SessionApi {
  /** The signed-in user, from the server. Also how a browser learns it has a session at start. */
  me(): Promise<CurrentUser>;
  /** Ends this device session on the server, then forgets it locally. */
  logout(): Promise<void>;
  /** Ends every session of the account, then forgets the local one. */
  logoutAll(): Promise<{ revoked: number }>;
  devices: DevicesApi;
}

export function createSessionApi(ctx: AuthContext): SessionApi {
  // A session the server already forgot is as good as logged out.
  const isAlreadyOver = (error: unknown): boolean => isApiError(error) && error.status === 401;

  return {
    async me(): Promise<CurrentUser> {
      const response = await ctx.client.get<unknown>("/auth/me");
      const data = response.data;
      if (!isRecord(data) || !isRecord(data.user) || typeof data.user.id !== "string") {
        throw unexpectedAnswer(response);
      }
      const user = data.user as unknown as CurrentUser;
      ctx.store.setUser(user);
      return user;
    },

    async logout(): Promise<void> {
      let failure: unknown;
      try {
        await ctx.client.post("/auth/logout");
      } catch (error) {
        if (!isAlreadyOver(error)) failure = error;
      }
      ctx.challenge.clear();
      await ctx.store.clear();
      if (failure) throw failure;
    },

    async logoutAll(): Promise<{ revoked: number }> {
      let revoked = 0;
      let failure: unknown;
      try {
        const response = await ctx.client.post<unknown>("/auth/logout-all");
        const data = response.data;
        revoked = isRecord(data) && typeof data.revoked === "number" ? data.revoked : 0;
      } catch (error) {
        if (!isAlreadyOver(error)) failure = error;
      }
      ctx.challenge.clear();
      await ctx.store.clear();
      if (failure) throw failure;
      return { revoked };
    },

    devices: {
      async list(): Promise<DeviceSession[]> {
        const response = await ctx.client.get<unknown>("/auth/sessions");
        const data = response.data;
        if (!isRecord(data) || !Array.isArray(data.sessions)) throw unexpectedAnswer(response);
        return data.sessions as DeviceSession[];
      },

      async disconnect(id): Promise<{ current: boolean }> {
        const response = await ctx.client.delete<unknown>(
          `/auth/sessions/${encodeURIComponent(id)}`,
        );
        const data = response.data;
        const current = isRecord(data) && data.current === true;
        if (current) {
          ctx.challenge.clear();
          await ctx.store.clear();
        }
        return { current };
      },
    },
  };
}
