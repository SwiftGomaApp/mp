import { AUTH_ENDPOINTS } from "./constants";
import { completeLogin, deviceBody, skipAuth, type FlowContext } from "./context";
import { parseCodeRequested, parseLogin } from "./mapping";
import type { CodeRequested, LoginResult } from "./types";

export interface EmailCodeRequestInput {
  email: string;
}

export interface PhoneCodeRequestInput {
  phone: string;
  channel?: "SMS" | "EMAIL";
}

export interface EmailCodeVerifyInput {
  email: string;
  code: string;
}

export interface PhoneCodeVerifyInput {
  phone: string;
  code: string;
}

export interface PasswordLoginInput {
  email: string;
  password: string;
}

export interface LoginApi {
  emailCode: {
    request(input: EmailCodeRequestInput): Promise<CodeRequested>;
    verify(input: EmailCodeVerifyInput): Promise<LoginResult>;
  };
  phoneCode: {
    request(input: PhoneCodeRequestInput): Promise<CodeRequested>;
    verify(input: PhoneCodeVerifyInput): Promise<LoginResult>;
  };
  password(input: PasswordLoginInput): Promise<LoginResult>;
}

export function createLogin(ctx: FlowContext): LoginApi {
  async function requestCode(body: Record<string, unknown>): Promise<CodeRequested> {
    const response = await ctx.api.post(AUTH_ENDPOINTS.loginOtpRequest, body, skipAuth());
    return parseCodeRequested(response.data);
  }

  async function verifyCode(
    target: { email: string } | { phone: string },
    code: string,
  ): Promise<LoginResult> {
    const device = await deviceBody(ctx);
    const response = await ctx.api.post(
      AUTH_ENDPOINTS.loginOtpVerify,
      { ...target, code, device },
      skipAuth(),
    );
    return completeLogin(ctx, parseLogin(response.data));
  }

  return {
    emailCode: {
      request: ({ email }) => requestCode({ email }),
      verify: ({ email, code }) => verifyCode({ email }, code),
    },
    phoneCode: {
      request: ({ phone, channel }) => requestCode({ phone, ...(channel ? { channel } : {}) }),
      verify: ({ phone, code }) => verifyCode({ phone }, code),
    },
    async password({ email, password }) {
      const device = await deviceBody(ctx);
      const response = await ctx.api.post(
        AUTH_ENDPOINTS.loginPassword,
        { email, password, device },
        skipAuth(),
      );
      return completeLogin(ctx, parseLogin(response.data));
    },
  };
}
