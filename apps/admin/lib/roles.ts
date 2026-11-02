export const STAFF_ROLES = ["SUPPORT", "ADMIN"] as const;

export function isStaffRole(role: string | null | undefined): role is (typeof STAFF_ROLES)[number] {
  return role === "SUPPORT" || role === "ADMIN";
}
