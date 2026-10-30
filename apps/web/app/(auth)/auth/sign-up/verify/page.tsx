import { VerifyOtpView } from "@/components/auth/verify-otp-view";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Confirmer votre inscription",
  description:
    "Saisissez le code à 6 chiffres reçu par e-mail ou SMS pour confirmer votre inscription à SwiftGoma.",
  path: "/auth/sign-up/verify",
  index: false,
});

const VerifySignUpPage = () => {
  return <VerifyOtpView flow="sign-up" />;
};

export default VerifySignUpPage;
