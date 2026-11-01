import { SignInView } from "@/components/auth/sign-in-view";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Se connecter",
  description:
    "Connectez-vous à votre compte SwiftGoma par e-mail, téléphone, Google, Apple ou empreinte pour suivre vos commandes et gérer votre boutique à Goma.",
  path: "/auth/sign-in",
  index: false,
});

const SignInPage = () => {
  return <SignInView />;
};

export default SignInPage;
