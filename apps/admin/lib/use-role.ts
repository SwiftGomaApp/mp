"use client";

import { useSession } from "swiftgoma-mp-auth/react";

/** True only for an ADMIN. SUPPORT sees read-only screens; the server enforces it anyway. */
export function useIsAdmin(): boolean {
  return useSession().user?.role === "ADMIN";
}
