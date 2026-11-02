import type { Metadata } from "next";

import { ForgotPasswordForm } from "@/components/setup-forms";

export const metadata: Metadata = { title: "Mot de passe oublié" };

export default function ForgotPage() {
  return <ForgotPasswordForm />;
}
