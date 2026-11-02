import type { Role } from "swiftgoma-mp-auth";

export const WEB_ALLOWED_ROLES: readonly Role[] = ["BUYER", "SELLER"];

export type WebAccess = "allowed" | "mobile-only" | "staff-denied";

export function webAccessFor(role: Role): WebAccess {
  if (WEB_ALLOWED_ROLES.includes(role)) return "allowed";
  if (role === "RIDER") return "mobile-only";
  return "staff-denied";
}
