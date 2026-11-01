import { ForgotPasswordView } from "@/components/auth/forgot-password-view";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Mot de passe oublié",
  description:
    "Réinitialisez le mot de passe de votre compte SwiftGoma avec un code reçu par e-mail.",
  path: "/auth/forgot-password",
  index: false,
});

const ForgotPasswordPage = () => {
  return <ForgotPasswordView />;
};

export default ForgotPasswordPage;
