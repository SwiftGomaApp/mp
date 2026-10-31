"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, type LucideIcon } from "lucide-react";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";

export interface NavMainItem {
  title: string;
  url: string;
  icon: LucideIcon;
  items: { title: string; url: string }[];
}

export function NavMain({ items }: { items: NavMainItem[] }) {
  const pathname = usePathname();
  // What the user opened or closed by hand. Until then a group is open while its page is shown.
  const [toggled, setToggled] = useState<Record<string, boolean>>({});

  return (
    <SidebarGroup>
      <SidebarGroupLabel>Mon compte</SidebarGroupLabel>
      <SidebarMenu>
        {items.map(({ title, url, icon: Icon, items: subItems }) => (
          <Collapsible
            key={url}
            open={toggled[url] ?? (pathname === url || pathname.startsWith(`${url}/`))}
            onOpenChange={(open) => setToggled((current) => ({ ...current, [url]: open }))}
            className="group/collapsible"
            render={<SidebarMenuItem />}
          >
            <CollapsibleTrigger render={<SidebarMenuButton tooltip={title} />}>
              <Icon />
              <span>{title}</span>
              <ChevronRight className="ml-auto transition-transform duration-200 group-data-open/collapsible:rotate-90" />
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {subItems.map((sub) => (
                  <SidebarMenuSubItem key={sub.url}>
                    <SidebarMenuSubButton
                      isActive={pathname === sub.url}
                      render={<Link href={sub.url} />}
                    >
                      <span>{sub.title}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                ))}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
