import { AUTH_ENDPOINTS, type SelfSignupRole } from "./constants";
import { deviceBody, openSession, skipAuth, type FlowContext } from "./context";
import { parseCodeRequested, parseResend, parseSignupVerified } from "./mapping";
import type { AuthUser, CodeRequested, ResendResult } from "./types";

interface SignupBase {
  name: string;
  role: SelfSignupRole;
  acceptTerms: true;
  confirmAge: true;
}

export interface SignupEmailInput extends SignupBase {
  email: string;
}

export interface SignupPhoneInput extends SignupBase {
  phone: string;
}

export interface VerifyEmailInput {
  email: string;
  code: string;
}

export interface VerifyPhoneInput {
  phone: string;
  code: string;
}

export interface SignupResult {
  user: AuthUser;
}

export interface SignupApi {
  email: {
    start(input: SignupEmailInput): Promise<CodeRequested>;
    verify(input: VerifyEmailInput): Promise<SignupResult>;
    resend(input: { email: string }): Promise<ResendResult>;
  };
  phone: {
    start(input: SignupPhoneInput): Promise<CodeRequested>;
    verify(input: VerifyPhoneInput): Promise<SignupResult>;
    resend(input: { phone: string }): Promise<ResendResult>;
  };
}

type Target = { email: string } | { phone: string };

export function createSignup(ctx: FlowContext): SignupApi {
  async function start(path: string, body: Record<string, unknown>): Promise<CodeRequested> {
    const response = await ctx.api.post(path, body, skipAuth());
    return parseCodeRequested(response.data);
  }

  async function verify(target: Target, code: string): Promise<SignupResult> {
    const device = await deviceBody(ctx);
    const response = await ctx.api.post(
      AUTH_ENDPOINTS.signupVerify,
      { ...target, code, device },
      skipAuth(),
    );
    const parsed = parseSignupVerified(response.data);
    await openSession(ctx, parsed.tokens);
    return { user: parsed.user };
  }

  async function resend(target: Target): Promise<ResendResult> {
    const response = await ctx.api.post(AUTH_ENDPOINTS.signupResend, target, skipAuth());
    return parseResend(response.data);
  }

  return {
    email: {
      start: ({ name, email, role, acceptTerms, confirmAge }) =>
        start(AUTH_ENDPOINTS.signupEmail, { name, email, role, acceptTerms, confirmAge }),
      verify: ({ email, code }) => verify({ email }, code),
      resend: ({ email }) => resend({ email }),
    },
    phone: {
      start: ({ name, phone, role, acceptTerms, confirmAge }) =>
        start(AUTH_ENDPOINTS.signupPhone, { name, phone, role, acceptTerms, confirmAge }),
      verify: ({ phone, code }) => verify({ phone }, code),
      resend: ({ phone }) => resend({ phone }),
    },
  };
}
