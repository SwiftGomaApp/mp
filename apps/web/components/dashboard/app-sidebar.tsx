"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LifeBuoy, LogOut, User, type LucideIcon } from "lucide-react";
import { useAuth, useSession } from "swiftgoma-mp-auth/react";

import { initialsOf, ROLE_LABELS } from "@/components/dashboard/user-display";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

const MAIN_NAV: NavItem[] = [{ href: "/profile", label: "Profil", icon: User }];
const SECONDARY_NAV: NavItem[] = [{ href: "/help", label: "Aide", icon: LifeBuoy }];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const auth = useAuth();
  const { user } = useSession();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await auth.logout();
    } finally {
      router.replace("/auth/sign-in");
    }
  }

  const renderLinks = (items: NavItem[]) =>
    items.map(({ href, label, icon: Icon }) => (
      <SidebarMenuItem key={href}>
        <SidebarMenuButton
          size="lg"
          isActive={pathname === href || pathname.startsWith(`${href}/`)}
          render={<Link href={href} />}
        >
          <Icon />
          {label}
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar variant="inset">
      <SidebarHeader className="p-3">
        <div className="flex items-center gap-3">
          {user ? (
            <>
              <Avatar size="lg" className="size-11">
                <AvatarFallback className="bg-primary/10 font-semibold text-primary">
                  {initialsOf(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="grid min-w-0 gap-0.5">
                <p className="truncate text-sm font-semibold">{user.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {ROLE_LABELS[user.role] ?? user.role}
                </p>
              </div>
            </>
          ) : (
            <>
              <Skeleton className="size-11 rounded-full" />
              <div className="grid flex-1 gap-2">
                <Skeleton className="h-3.5 w-28" />
                <Skeleton className="h-3 w-16" />
              </div>
            </>
          )}
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>{renderLinks(MAIN_NAV)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarSeparator />

      <SidebarFooter>
        <SidebarMenu>
          {renderLinks(SECONDARY_NAV)}
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? <Spinner /> : <LogOut />}
              Se déconnecter
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
