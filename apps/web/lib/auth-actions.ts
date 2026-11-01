import type { LoginResult } from "swiftgoma-mp-auth";

import type { SignUpRole, VerificationMethod, VerificationTarget } from "@/lib/auth-flow";
import { auth } from "@/lib/auth";

export type SignInOutcome = "authenticated" | "twoFactor" | "twoFactorEnrollment";

function toOutcome(result: LoginResult): SignInOutcome {
  if (result.status === "twoFactorRequired") return "twoFactor";
  if (result.status === "twoFactorEnrollmentRequired") return "twoFactorEnrollment";
  return "authenticated";
}

export async function signInWithGoogle() {
  return toOutcome(await auth.login.google());
}

export async function signInWithPasskey() {
  return toOutcome(await auth.login.passkey());
}

export function requestSignInCode(target: Pick<VerificationTarget, "method" | "value">) {
  return target.method === "email"
    ? auth.login.emailCode.request({ email: target.value })
    : auth.login.phoneCode.request({ phone: target.value });
}

export async function verifySignInCode(
  target: Pick<VerificationTarget, "method" | "value">,
  code: string,
): Promise<SignInOutcome> {
  const result =
    target.method === "email"
      ? await auth.login.emailCode.verify({ email: target.value, code })
      : await auth.login.phoneCode.verify({ phone: target.value, code });

  return toOutcome(result);
}

export type { SignUpRole };

export interface SignUpInput {
  method: VerificationMethod;
  value: string;
  name: string;
  role: SignUpRole;
}

export function requestSignUp({ method, value, name, role }: SignUpInput) {
  const base = { name, role, acceptTerms: true, confirmAge: true } as const;
  return method === "email"
    ? auth.signup.email({ ...base, email: value })
    : auth.signup.phone({ ...base, phone: value });
}

export async function verifySignUpCode(
  target: Pick<VerificationTarget, "method" | "value">,
  code: string,
) {
  await auth.signup.verify(
    target.method === "email" ? { email: target.value, code } : { phone: target.value, code },
  );
}

export function resendSignUpCode(target: Pick<VerificationTarget, "method" | "value">) {
  return auth.signup.resend(
    target.method === "email" ? { email: target.value } : { phone: target.value },
  );
}

export async function signUpWithGoogle(role: SignUpRole) {
  return toOutcome(await auth.signup.google({ role, acceptTerms: true, confirmAge: true }));
}
