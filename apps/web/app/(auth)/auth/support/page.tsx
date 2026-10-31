import { ContactSupportView } from "@/components/auth/contact-support-view";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Contacter le Support",
  description: "Contactez le Support SwiftGoma si votre compte est suspendu.",
  path: "/auth/support",
  index: false,
});

const SupportPage = () => {
  return <ContactSupportView />;
};

export default SupportPage;
