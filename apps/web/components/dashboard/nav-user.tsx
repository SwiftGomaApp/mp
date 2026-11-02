"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ChevronsUpDown, LogOut, ShieldCheck, User } from "lucide-react";
import { useSession } from "swiftgoma-mp-auth/react";

import { useLogout } from "@/components/auth/logout-screen";
import { initialsOf, ROLE_LABELS } from "@/components/dashboard/user-display";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { loadAvatar, useAvatarUrl } from "@/lib/avatar-store";

function UserSummary({
  name,
  role,
  avatarUrl,
}: {
  name: string;
  role: string;
  avatarUrl?: string | null;
}) {
  return (
    <>
      <Avatar>
        {avatarUrl && <AvatarImage src={avatarUrl} alt="" />}
        <AvatarFallback className="bg-primary/10 font-semibold text-primary">
          {initialsOf(name)}
        </AvatarFallback>
      </Avatar>
      <div className="grid flex-1 text-left text-sm leading-tight">
        <span className="truncate font-medium">{name}</span>
        <span className="truncate text-xs text-muted-foreground">{ROLE_LABELS[role] ?? role}</span>
      </div>
    </>
  );
}

export function NavUser() {
  const { user } = useSession();
  const { isMobile } = useSidebar();
  const { logout, isLoggingOut } = useLogout();
  const avatarUrl = useAvatarUrl(user?.id);
  const userId = user?.id;

  useEffect(() => {
    if (userId) void loadAvatar(userId);
  }, [userId]);

  if (!user) {
    return (
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton size="lg" disabled>
            <Skeleton className="size-8 shrink-0 rounded-full" />
            <div className="grid flex-1 gap-1.5">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-2.5 w-14" />
            </div>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    );
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={<SidebarMenuButton size="lg" className="aria-expanded:bg-muted" />}
          >
            <UserSummary name={user.name} role={user.role} avatarUrl={avatarUrl} />
            <ChevronsUpDown className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-sm">
                  <UserSummary name={user.name} role={user.role} avatarUrl={avatarUrl} />
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem render={<Link href="/profile" />}>
                <User />
                Informations du profil
              </DropdownMenuItem>
              <DropdownMenuItem render={<Link href="/profile/security" />}>
                <ShieldCheck />
                Sécurité
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout} disabled={isLoggingOut}>
              {isLoggingOut ? <Spinner /> : <LogOut />}
              Se déconnecter
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
