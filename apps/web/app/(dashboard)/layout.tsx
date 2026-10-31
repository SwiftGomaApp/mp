import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Mon compte",
  description: "Gérez votre profil et la sécurité de votre compte SwiftGoma.",
  path: "/profile",
  index: false,
});

// The shell shows a spinner until the session is known, so no page below it can be part of an
// instant navigation: the whole signed-in area opts out of that validation.
export const instant = false;

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return <DashboardShell>{children}</DashboardShell>;
}
