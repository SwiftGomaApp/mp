import type { LoginResult } from "swiftgoma-mp-auth";

import type { VerificationTarget } from "@/lib/auth-flow";
import { auth } from "@/lib/auth";

export const signInWithGoogle = (): Promise<LoginResult> => auth.login.google();

export const signInWithPasskey = (): Promise<LoginResult> => auth.login.passkey();

export function requestSignInCode(target: Pick<VerificationTarget, "method" | "value">) {
  return target.method === "email"
    ? auth.login.emailCode.request({ email: target.value })
    : auth.login.phoneCode.request({ phone: target.value });
}

export function verifySignInCode(
  target: Pick<VerificationTarget, "method" | "value">,
  code: string,
): Promise<LoginResult> {
  return target.method === "email"
    ? auth.login.emailCode.verify({ email: target.value, code })
    : auth.login.phoneCode.verify({ phone: target.value, code });
}
