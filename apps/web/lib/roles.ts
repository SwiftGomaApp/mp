import type { Role } from "swiftgoma-mp-auth";

export const WEB_ALLOWED_ROLES: readonly Role[] = ["BUYER", "SELLER"];

export type WebAccess = "allowed" | "mobile-only" | "staff-denied";

export function webAccessFor(role: Role): WebAccess {
  if (WEB_ALLOWED_ROLES.includes(role)) return "allowed";
  if (role === "RIDER") return "mobile-only";
  return "staff-denied";
}

export const SELLER_HOME_PATH = "/seller";
export const BUYER_HOME_PATH = "/profile";

/** Where a signed-in user lands once `/dashboard` resolves their role. */
export function homePathFor(role: Role): string {
  return role === "SELLER" ? SELLER_HOME_PATH : BUYER_HOME_PATH;
}

/** Areas that only one role may open. */
export function isSellerArea(pathname: string): boolean {
  return pathname === SELLER_HOME_PATH || pathname.startsWith(`${SELLER_HOME_PATH}/`);
}
