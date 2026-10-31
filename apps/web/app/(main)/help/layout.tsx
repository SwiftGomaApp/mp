import { Logo } from "@/components/global/logo";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

import { ModeToggle } from "@/components/global/theme-button";
import { LegalFooter } from "@/components/legal/legal-footer";

export default function HelpLayout({ children }: LayoutProps<"/help">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5"
            aria-label="Accueil SwiftGoma"
          >
            <Logo size="sm" />
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href="/profile"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ChevronLeft className="size-3.5" />
              Mon compte
            </Link>
            <ModeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1">{children}</main>

      <LegalFooter />
    </div>
  );
}
