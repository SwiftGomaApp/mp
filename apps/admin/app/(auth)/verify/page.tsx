import { Suspense } from "react";
import type { Metadata } from "next";

import { VerifyOtpView } from "@/components/auth/verify-otp-view";

export const metadata: Metadata = { title: "Vérifier votre connexion" };

export default function VerifyPage() {
  return (
    <Suspense>
      <VerifyOtpView />
    </Suspense>
  );
}
