import Image from "next/image";
import Link from "next/link";

import { ModeToggle } from "@/components/global/theme-button";
import { LegalFooter } from "@/components/legal/legal-footer";
import { LegalNav } from "@/components/legal/legal-nav";
import { siteConfig } from "@/lib/site";

export default function LegalLayout({ children }: LayoutProps<"/legale">) {
  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2.5"
            aria-label="Accueil SwiftGoma"
          >
            <Image src={siteConfig.logo} alt="" width={28} height={28} priority />
            <span className="font-bold tracking-tight">{siteConfig.shortName}</span>
          </Link>
          <ModeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <LegalNav />
        </div>
        {children}
      </main>

      <LegalFooter />
    </div>
  );
}
