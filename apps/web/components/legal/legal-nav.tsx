"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "cn";
import { legalDocuments, legalPath } from "@/lib/legal";

export function LegalNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Documents légaux" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="flex w-max gap-2 sm:w-auto sm:flex-wrap">
        {legalDocuments.map((document) => {
          const href = legalPath(document.slug);
          const isActive = pathname === href;

          return (
            <li key={document.slug}>
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-3.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  isActive
                    ? "border-primary bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                {document.shortTitle}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
