"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "swiftgoma-mp-auth/react";

import { AppSidebar } from "@/components/dashboard/app-sidebar";
import { RecoveryAlert } from "@/components/dashboard/recovery-alert";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Spinner } from "@/components/ui/spinner";

/** The signed-in area: a sidebar and the page. Anonymous visitors are sent to the sign-in page. */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === "anonymous") router.replace("/auth/sign-in");
  }, [status, router]);

  if (status !== "authenticated") {
    return (
      <div className="flex min-h-svh items-center justify-center text-muted-foreground">
        <Spinner className="size-5" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
        </header>
        <RecoveryAlert />
        <div className="flex-1 overflow-y-auto">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  );
}
