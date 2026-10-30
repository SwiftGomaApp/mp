import { parseDrcPhone } from "@/lib/phone";

export type VerificationMethod = "email" | "phone";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// TODO: remove once the server tells us whether the account has two-step verification turned on.
export function devRequiresTwoFactor(contact: string) {
  return process.env.NODE_ENV !== "production" && contact.trim().toLowerCase().startsWith("2fa");
}

export function isValidEmail(email: string) {
  return EMAIL_PATTERN.test(email.trim());
}

export type AuthFlow = "sign-in" | "sign-up";

export interface VerificationTarget {
  flow: AuthFlow;
  method: VerificationMethod;
  value: string;
  fullName?: string;
}

const STORAGE_KEY = "swiftgoma:verification-target";

export function saveVerificationTarget(target: VerificationTarget) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(target));
  } catch {}
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
