import { SignUpView } from "@/components/auth/sign-up-view";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Créer un compte",
  description:
    "Créez votre compte SwiftGoma gratuitement : achetez auprès des boutiques de Goma, vendez vos produits ou devenez livreur. Paiement Mobile Money sécurisé.",
  path: "/auth/sign-up",
});

const SignUpPage = () => {
  return <SignUpView />;
};

export default SignUpPage;
