import { SiteFooter } from "@/components/global/site-footer";
import { SiteHeader } from "@/components/global/site-header";

export default function MainLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </>
  );
}
