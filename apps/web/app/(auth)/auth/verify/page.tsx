import { VerifyOtpView } from "@/components/auth/verify-otp-view";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Vérifier votre connexion",
  description:
    "Saisissez le code à 6 chiffres reçu par e-mail ou SMS pour confirmer votre connexion à SwiftGoma.",
  path: "/auth/verify",
  index: false,
});

const VerifyPage = () => {
  return <VerifyOtpView flow="sign-in" />;
};

export default VerifyPage;
