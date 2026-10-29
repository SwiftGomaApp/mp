import type { AuthContext } from "./context";
import type { SelfSignupRole } from "./constants";
import { applySessionAnswer, isRecord, unexpectedAnswer } from "./answers";
import type { AuthUser, ContactTarget, OtpSent } from "./types";

interface SignupInputBase {
  name: string;
  role: SelfSignupRole;
  /** The user accepted the terms of use and the privacy policy. */
  acceptTerms: true;
  /** The user confirmed the minimum age. */
  confirmAge: true;
}

export interface EmailSignupInput extends SignupInputBase {
  email: string;
}

export interface PhoneSignupInput extends SignupInputBase {
  /** A Congolese number, as the server accepts it. */
  phone: string;
}

export type SignupVerifyInput = ContactTarget & { code: string };

export interface SignupApi {
  /** Creates a pending account and sends the confirmation code by e-mail. */
  email(input: EmailSignupInput): Promise<OtpSent>;
  /** Creates a pending account and sends the confirmation code by SMS. */
  phone(input: PhoneSignupInput): Promise<OtpSent>;
  /** Confirms the code. The account becomes active and the user is signed in. */
  verify(input: SignupVerifyInput): Promise<{ user: AuthUser }>;
  /** Sends the code again. The answer is the same whether or not the account exists. */
  resend(target: ContactTarget): Promise<{ message: string }>;
}

function readOtpSent(data: unknown, response: Parameters<typeof unexpectedAnswer>[0]): OtpSent {
  if (
    !isRecord(data) ||
    (data.method !== "EMAIL" && data.method !== "PHONE") ||
    typeof data.target !== "string" ||
    typeof data.expiresMinutes !== "number"
  ) {
    throw unexpectedAnswer(response);
  }
  return { method: data.method, target: data.target, expiresMinutes: data.expiresMinutes };
}

export function createSignupApi(ctx: AuthContext): SignupApi {
  const startSignup = async (path: string, body: object): Promise<OtpSent> => {
    const response = await ctx.client.post<unknown>(path, body);
    return readOtpSent(response.data, response);
  };

  return {
    email: (input) => startSignup("/auth/signup/email", input),
    phone: (input) => startSignup("/auth/signup/phone", input),

    async verify(input): Promise<{ user: AuthUser }> {
      const device = await ctx.device.get();
      const response = await ctx.client.post<unknown>("/auth/signup/verify", { ...input, device });
      const { user } = await applySessionAnswer(ctx, response);
      return { user };
    },

    async resend(target): Promise<{ message: string }> {
      const response = await ctx.client.post<unknown>("/auth/signup/resend", target);
      const data = response.data;
      if (!isRecord(data) || typeof data.message !== "string") throw unexpectedAnswer(response);
      return { message: data.message };
    },
  };
}
