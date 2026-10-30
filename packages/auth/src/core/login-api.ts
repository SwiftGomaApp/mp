import type { AuthContext } from "./context";
import { applyLoginAnswer, isRecord, unexpectedAnswer } from "./answers";
import type { LoginResult, OtpSent } from "./types";

export interface EmailCodeLogin {
  /** Sends a sign-in code to the e-mail address. */
  request(input: { email: string }): Promise<OtpSent>;
  verify(input: { email: string; code: string }): Promise<LoginResult>;
}

export interface PhoneCodeLogin {
  /**
   * Sends a sign-in code to the phone. With `channel: "EMAIL"` the code goes to the verified
   * e-mail of the account instead, and `target` in the answer is that address, masked.
   */
  request(input: { phone: string; channel?: "SMS" | "EMAIL" }): Promise<OtpSent>;
  verify(input: { phone: string; code: string }): Promise<LoginResult>;
}

export interface LoginApi {
  emailCode: EmailCodeLogin;
  phoneCode: PhoneCodeLogin;
  password(input: { email: string; password: string }): Promise<LoginResult>;
}

export function createLoginApi(ctx: AuthContext): LoginApi {
  const requestCode = async (body: object): Promise<OtpSent> => {
    const response = await ctx.client.post<unknown>("/auth/login/otp/request", body);
    const data = response.data;
    if (
      !isRecord(data) ||
      (data.method !== "EMAIL" && data.method !== "PHONE") ||
      typeof data.target !== "string" ||
      typeof data.expiresMinutes !== "number"
    ) {
      throw unexpectedAnswer(response);
    }
    return { method: data.method, target: data.target, expiresMinutes: data.expiresMinutes };
  };

  const signIn = async (path: string, body: object): Promise<LoginResult> => {
    const device = await ctx.device.get();
    return applyLoginAnswer(ctx, await ctx.client.post<unknown>(path, { ...body, device }));
  };

  return {
    emailCode: {
      request: (input) => requestCode(input),
      verify: (input) => signIn("/auth/login/otp/verify", input),
    },
    phoneCode: {
      request: (input) => requestCode(input),
      verify: (input) => signIn("/auth/login/otp/verify", input),
    },
    password: (input) => signIn("/auth/login/password", input),
  };
}
