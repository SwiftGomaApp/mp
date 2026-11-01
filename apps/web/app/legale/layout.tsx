import { SiteFooter } from "@/components/global/site-footer";
import { SiteHeader } from "@/components/global/site-header";
import { LegalNav } from "@/components/legal/legal-nav";

export default function LegalLayout({ children }: LayoutProps<"/legale">) {
  return (
    <div className="flex min-h-svh flex-col">
      <SiteHeader />

      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-8">
          <LegalNav />
        </div>
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
