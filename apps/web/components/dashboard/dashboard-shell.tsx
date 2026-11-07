"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "swiftgoma-mp-auth/react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { RecoveryAlert } from "@/components/dashboard/recovery-alert";
import { RoleBlocked } from "@/components/dashboard/role-blocked";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";
import { BUYER_HOME_PATH, isSellerArea, webAccessFor } from "@/lib/roles";
import { SellerVerificationGate } from "@/components/dashboard/seller-verification-gate";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { status, user } = useSession();

  const isWrongArea = Boolean(user) && isSellerArea(pathname) && user?.role !== "SELLER";

  useEffect(() => {
    if (status === "anonymous") router.replace("/auth/sign-in");
  }, [status, router]);

  useEffect(() => {
    if (isWrongArea) router.replace(BUYER_HOME_PATH);
  }, [isWrongArea, router]);

  if (status !== "authenticated" || !user || isWrongArea) {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        <Spinner className="size-5" />
      </div>
    );
  }

  const access = webAccessFor(user.role);
  if (access !== "allowed") {
    return <RoleBlocked role={user.role} kind={access} />;
  }

  const shell = (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="ml-auto">
            <NotificationBell />
          </div>
        </header>
        <RecoveryAlert />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );

  if (user.role === "SELLER" && isSellerArea(pathname)) {
    return <SellerVerificationGate>{shell}</SellerVerificationGate>;
  }

  return shell;
}
