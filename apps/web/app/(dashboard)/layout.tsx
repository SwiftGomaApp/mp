import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Mon compte",
  description: "Gérez votre profil et la sécurité de votre compte SwiftGoma.",
  path: "/profile",
  index: false,
});

export default function DashboardLayout({ children }: LayoutProps<"/">) {
  return <DashboardShell>{children}</DashboardShell>;
}
