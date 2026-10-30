"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, LifeBuoy, Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const THEME_OPTIONS = [
  { value: "light", label: "Clair", icon: Sun },
  { value: "dark", label: "Sombre", icon: Moon },
  { value: "system", label: "Système", icon: Monitor },
] as const;

/** Help and the theme picker, side by side in the sidebar. */
export function NavSecondary() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const { isMobile } = useSidebar();

  return (
    <SidebarGroup className="mt-auto">
      <SidebarGroupLabel>Assistance</SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Aide"
            isActive={pathname === "/help"}
            render={<Link href="/help" />}
          >
            <LifeBuoy />
            <span>Aide</span>
          </SidebarMenuButton>
        </SidebarMenuItem>

        <SidebarMenuItem>
          <DropdownMenu>
            <DropdownMenuTrigger render={<SidebarMenuButton tooltip="Thème" />}>
              <Sun className="dark:hidden" />
              <Moon className="hidden dark:block" />
              <span>Thème</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent side={isMobile ? "top" : "right"} align="end">
              {THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
                <DropdownMenuItem key={value} onClick={() => setTheme(value)}>
                  <Icon />
                  {label}
                  {theme === value && <Check className="ml-auto" />}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarGroup>
  );
}
