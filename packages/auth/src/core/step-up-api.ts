import type { AuthContext } from "./context";
import { isRecord, unexpectedAnswer } from "./answers";

/** Where a step-up code was sent. */
export interface StepUpSent {
  channel: "EMAIL" | "PHONE";
  target: string;
  expiresMinutes: number;
}

export interface StepUpApi {
  /**
   * Sends a fresh code to a verified contact of the signed-in user. Sensitive actions (password
   * changes, linking a provider, recovery contacts, passkeys, two-step setup) take that code as
   * a parameter. The package never keeps it.
   *
   * When the account has two-step verification, the code the actions expect is the one from the
   * authenticator app instead, so the app may skip this call (see `CurrentUser.twoFactorEnabled`).
   */
  request(input?: { channel?: "EMAIL" | "PHONE" }): Promise<StepUpSent>;
}

export function createStepUpApi(ctx: AuthContext): StepUpApi {
  return {
    async request(input = {}): Promise<StepUpSent> {
      const response = await ctx.client.post<unknown>("/auth/step-up/otp", input);
      const data = response.data;
      if (
        !isRecord(data) ||
        (data.channel !== "EMAIL" && data.channel !== "PHONE") ||
        typeof data.target !== "string" ||
        typeof data.expiresMinutes !== "number"
      ) {
        throw unexpectedAnswer(response);
      }
      return { channel: data.channel, target: data.target, expiresMinutes: data.expiresMinutes };
    },
  };
}
