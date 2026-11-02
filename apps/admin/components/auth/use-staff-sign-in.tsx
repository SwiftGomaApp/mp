"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthUser, LoginResult } from "swiftgoma-mp-auth";

import { EnrollDialog } from "@/components/auth/enroll-dialog";
import { TwoFactorDialog } from "@/components/auth/two-factor-dialog";
import { auth } from "@/lib/auth";
import { POST_LOGIN_PATH } from "@/lib/auth-flow";
import { isStaffRole } from "@/lib/roles";

export const REFUSED_MESSAGE =
  "Accès refusé : cette console est réservée au Support et aux Administrateurs.";

/**
 * Finishes a sign-in made with any method (code, password, Google, passkey). Only Support and
 * Admin accounts get in: any other role is signed out again right away.
 */
export function useStaffSignIn() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next");
  const target = next && next.startsWith("/") && !next.startsWith("//") ? next : POST_LOGIN_PATH;

  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [refused, setRefused] = useState(params.get("denied") === "1");

  /** Returns true when the user was let in. */
  async function accept(user: AuthUser): Promise<boolean> {
    if (!isStaffRole(user.role)) {
      await auth.logout().catch(() => undefined);
      setRefused(true);
      return false;
    }
    router.replace(target);
    return true;
  }

  async function handle(result: LoginResult) {
    setRefused(false);
    if (result.status === "authenticated") await accept(result.user);
    else if (result.status === "twoFactorRequired") setTwoFactorOpen(true);
    else setEnrollOpen(true);
  }

  const dialogs = (
    <>
      <TwoFactorDialog
        open={twoFactorOpen}
        onOpenChange={setTwoFactorOpen}
        onVerified={(user) => {
          setTwoFactorOpen(false);
          void accept(user);
        }}
      />
      <EnrollDialog open={enrollOpen} onOpenChange={setEnrollOpen} onDone={accept} />
    </>
  );

  return { handle, accept, refused, dialogs };
}
