import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient, fetchCurrentUser } from "swiftgoma-mp-auth/web/server";

import { ConsoleShell } from "@/components/console-shell";
import { isStaffRole } from "@/lib/roles";

/**
 * Server-side gate: a visitor whose session is a non-staff account is refused before any page
 * renders. When the API cookie is not visible to this server (separate hosts in development),
 * the client guard in `ConsoleShell` does the same check in the browser.
 */
async function refuseNonStaff() {
  const baseUrl = process.env.NEXT_PUBLIC_API_ORIGIN;
  if (!baseUrl) return;
  try {
    const client = createServerClient({ baseUrl, cookie: (await headers()).get("cookie") });
    const user = await fetchCurrentUser(client);
    if (user && !isStaffRole(user.role)) redirect("/login?denied=1");
  } catch (error) {
    // redirect() throws a control-flow error that must go through; anything else falls back to
    // the client guard.
    if (error && typeof error === "object" && "digest" in error) throw error;
  }
}

export default async function ProtectedLayout({ children }: { children: React.ReactNode }) {
  await refuseNonStaff();
  return <ConsoleShell>{children}</ConsoleShell>;
}
