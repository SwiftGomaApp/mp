import { parseDrcPhone } from "@/lib/phone";

/** Where the user lands after every successful sign-in or sign-up. */
export const POST_LOGIN_PATH = "/dashboard";

export type VerificationMethod = "email" | "phone";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim());
}

export type SignUpRole = "BUYER" | "SELLER" | "RIDER";

const SIGN_UP_ROLES: readonly string[] = ["BUYER", "SELLER", "RIDER"];

export type AuthFlow = "sign-in" | "sign-up";

export interface VerificationTarget {
  flow: AuthFlow;
  method: VerificationMethod;
  value: string;
  fullName?: string;
  role?: SignUpRole;
}

const STORAGE_KEY = "swiftgoma:verification-target";

const RESEND_AT_KEY = "swiftgoma:resend-at";

export const RESEND_DELAY_SECONDS = 60;

/** Starts the resend cooldown; it is stored so a page refresh does not restart it. */
export function startResendCooldown() {
  try {
    sessionStorage.setItem(RESEND_AT_KEY, String(Date.now() + RESEND_DELAY_SECONDS * 1000));
  } catch {}
}

export function readResendSecondsLeft(): number {
  try {
    const resendAt = Number(sessionStorage.getItem(RESEND_AT_KEY));
    if (!Number.isFinite(resendAt)) return 0;
    return Math.min(RESEND_DELAY_SECONDS, Math.max(0, Math.ceil((resendAt - Date.now()) / 1000)));
  } catch {
    return 0;
  }
}

/** Call right after a code was sent: stores the target and starts the cooldown. */
export function saveVerificationTarget(target: VerificationTarget) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(target));
  } catch {}
  startResendCooldown();
}

export function readStoredVerificationTarget(): string | null {
  try {
    return sessionStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function readVerificationTarget(): VerificationTarget | null {
  return parseVerificationTarget(readStoredVerificationTarget());
}

export function clearVerificationTarget() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(RESEND_AT_KEY);
  } catch {}
}

export function parseVerificationTarget(raw: string | null): VerificationTarget | null {
  if (!raw) return null;

  try {
    const target = JSON.parse(raw) as Partial<VerificationTarget>;
    if (
      (target.flow === "sign-in" || target.flow === "sign-up") &&
      (target.method === "email" || target.method === "phone") &&
      typeof target.value === "string"
    ) {
      return {
        flow: target.flow,
        method: target.method,
        value: target.value,
        fullName: typeof target.fullName === "string" ? target.fullName : undefined,
        role: SIGN_UP_ROLES.includes(target.role ?? "") ? target.role : undefined,
      };
    }
  } catch {}

  return null;
}

export function maskEmail(email: string) {
  const [local = "", domain = ""] = email.split("@");
  const visibleEnd = local.length > 4 ? local.slice(-2) : "";
  const hidden = "*".repeat(Math.max(local.length - 1 - visibleEnd.length, 3));

  return `${local.slice(0, 1)}${hidden}${visibleEnd}@${domain}`;
}

export function maskPhone(e164: string) {
  const { national } = parseDrcPhone(e164);

  return `+243 ${national.slice(0, 2)} *** **${national.slice(-2)}`;
}

export function maskVerificationTarget({ method, value }: VerificationTarget) {
  return method === "email" ? maskEmail(value) : maskPhone(value);
}
