"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";

const TABS = [
  { href: "/profile", label: "Informations du profil" },
  { href: "/profile/security", label: "Sécurité" },
];

export function ProfileTabs() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections du profil" className="-mb-px flex gap-6 overflow-x-auto">
      {TABS.map((tab) => {
        const isActive = pathname === tab.href;

        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "border-b-2 pb-3 text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:text-foreground",
              isActive
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
