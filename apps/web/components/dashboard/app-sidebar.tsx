"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Store, User } from "lucide-react";
import { useSession } from "swiftgoma-mp-auth/react";

import { NavMain, type NavMainItem } from "@/components/dashboard/nav-main";
import { NavSecondary } from "@/components/dashboard/nav-secondary";
import { NavUser } from "@/components/dashboard/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV_MAIN: NavMainItem[] = [
  {
    title: "Profil",
    url: "/profile",
    icon: User,
    items: [
      { title: "Informations du profil", url: "/profile" },
      { title: "Sécurité", url: "/profile/security" },
      { title: "Appareils", url: "/profile/devices" },
      { title: "Activité", url: "/profile/activity" },
    ],
  },
  {
    title: "Notifications",
    url: "/notifications",
    icon: Bell,
    items: [
      { title: "Boîte de réception", url: "/notifications" },
      { title: "Préférences", url: "/notifications/settings" },
    ],
  },
];

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const { user } = useSession();

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" tooltip="SwiftGoma" render={<Link href="/" />}>
              <Image
                src="/logo-icon.png"
                alt=""
                width={32}
                height={32}
                className="size-8 shrink-0 rounded-lg"
              />
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">SwiftGoma</span>
                <span className="truncate text-xs text-muted-foreground">Marketplace</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {user?.role === "SELLER" && (
          <SidebarGroup>
            <SidebarGroupLabel>Vendeur</SidebarGroupLabel>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip="Espace vendeur"
                  isActive={pathname === "/seller" || pathname.startsWith("/seller/")}
                  render={<Link href="/seller" />}
                >
                  <Store />
                  <span>Espace vendeur</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
        <NavMain items={NAV_MAIN} />
        <NavSecondary />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
