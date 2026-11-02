import { Suspense } from "react";
import type { Metadata } from "next";

import { StaffSetupForm } from "@/components/setup-forms";

export const metadata: Metadata = { title: "Activer mon compte" };

export default function SetupPage() {
  return (
    <Suspense>
      <StaffSetupForm />
    </Suspense>
  );
}
