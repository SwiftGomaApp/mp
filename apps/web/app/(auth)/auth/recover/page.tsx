import { RecoverAccountView } from "@/components/auth/recover-account-view";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Récupérer votre compte",
  description:
    "Retrouvez l’accès à votre compte SwiftGoma lorsque vous n’avez plus accès à votre e-mail ni à votre téléphone.",
  path: "/auth/recover",
  index: false,
});

const RecoverPage = () => {
  return <RecoverAccountView />;
};

export default RecoverPage;
