"use client";

import { useCallback, useEffect, useState } from "react";
import { Check } from "lucide-react";
import type { SignInMethods } from "swiftgoma-mp-auth/account";

import { AppleIcon, GoogleIcon } from "@/components/auth/social-buttons";
import {
  LinkSocialDialog,
  type SocialProviderName,
} from "@/components/security/link-social-dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { account } from "@/lib/account";
import { auth } from "@/lib/auth";

const PROVIDERS: { key: SocialProviderName; label: string; icon: React.ReactNode }[] = [
  { key: "google", label: "Google", icon: <GoogleIcon /> },
  { key: "apple", label: "Apple", icon: <AppleIcon /> },
];

/** Google and Apple sign-in for the account. A provider the app did not enable is not shown. */
export function LinkedAccounts() {
  const [methods, setMethods] = useState<SignInMethods | null>(null);
  const [linking, setLinking] = useState<SocialProviderName | null>(null);

  const load = useCallback(() => {
    account.methods
      .list()
      .then(setMethods)
      .catch(() => {
        // Without the list the buttons stay in their loading state.
      });
  }, []);

  useEffect(load, [load]);

  const providers = PROVIDERS.filter(({ key }) => auth.socials.enabled[key]);
  if (providers.length === 0) return null;

  return (
    <section className="grid gap-3">
      <div className="grid gap-0.5">
        <h2 className="font-semibold">Comptes liés</h2>
        <p className="text-sm text-muted-foreground">
          Connectez-vous plus vite avec un compte que vous possédez déjà.
        </p>
      </div>

      <ul className="grid gap-3">
        {providers.map(({ key, label, icon }) => {
          const linked = methods?.[key];

          return (
            <li key={key} className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted [&_svg]:size-5">
                {icon}
              </span>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="text-sm font-semibold">{label}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {linked ? (linked.email ?? "Compte lié") : "Non lié"}
                </p>
              </div>
              {!methods ? (
                <Skeleton className="h-8 w-16 rounded-lg" />
              ) : linked ? (
                <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <Check className="size-4" />
                  Lié
                </span>
              ) : (
                <Button size="sm" onClick={() => setLinking(key)}>
                  Lier
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      <LinkSocialDialog
        provider={linking}
        onOpenChange={(open) => !open && setLinking(null)}
        onLinked={load}
      />
    </section>
  );
}
