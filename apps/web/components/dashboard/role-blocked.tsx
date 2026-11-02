"use client";

import Link from "next/link";
import { ShieldAlert, Smartphone } from "lucide-react";
import type { Role } from "swiftgoma-mp-auth";

import { useLogout } from "@/components/auth/logout-screen";
import { ROLE_LABELS } from "@/components/dashboard/user-display";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// TODO: replace with the real store links once the rider app is published.
const STORE_LINKS = {
  android: "#",
  ios: "#",
};

export function RoleBlocked({ role, kind }: { role: Role; kind: "mobile-only" | "staff-denied" }) {
  const { logout, isLoggingOut } = useLogout();
  const isRider = kind === "mobile-only";
  const Icon = isRider ? Smartphone : ShieldAlert;

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-md flex-col items-center gap-5 text-center">
        <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Icon className="size-7" />
        </div>

        {isRider ? (
          <>
            <h1 className="text-2xl font-semibold">Utilisez l&apos;application mobile</h1>
            <p className="text-sm text-muted-foreground">
              Les comptes livreur se gèrent depuis l&apos;application mobile SwiftGoma.
              Téléchargez-la pour recevoir des courses et suivre vos livraisons.
            </p>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <Button className="flex-1" render={<Link href={STORE_LINKS.android} />}>
                Télécharger sur Android
              </Button>
              <Button className="flex-1" variant="outline" render={<Link href={STORE_LINKS.ios} />}>
                Télécharger sur iOS
              </Button>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">Accès non autorisé</h1>
            <p className="text-sm text-muted-foreground">
              Le rôle <strong>{ROLE_LABELS[role] ?? role}</strong> n&apos;est pas autorisé sur cette
              URL. Utilisez l&apos;espace dédié à votre équipe.
            </p>
          </>
        )}

        <Button variant="ghost" onClick={logout} disabled={isLoggingOut}>
          {isLoggingOut && <Spinner className="size-4" />}
          Se déconnecter
        </Button>
      </div>
    </div>
  );
}
