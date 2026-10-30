"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, TriangleAlert } from "lucide-react";
import { useAuth, useSession } from "swiftgoma-mp-auth/react";

import { ROLE_LABELS } from "@/components/dashboard/user-display";
import { Skeleton } from "@/components/ui/skeleton";

type CurrentUser = Awaited<ReturnType<ReturnType<typeof useAuth>["me"]>>;

const VERIFICATION_LABELS: Record<string, string> = {
  NOT_SUBMITTED: "Documents non envoyés",
  PENDING: "En attente",
  IN_REVIEW: "En cours d’examen",
  APPROVED: "Approuvé",
  REJECTED: "Refusé",
};

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });
const formatDate = (iso: string | null) => (iso ? dateFormatter.format(new Date(iso)) : "—");

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`grid gap-1 rounded-lg border bg-card px-3.5 py-2.5 ${className ?? ""}`}>
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="flex min-h-6 items-center gap-2 text-sm font-medium break-words">
        {children}
      </dd>
    </div>
  );
}

function VerifiedBadge({ verified }: { verified: boolean }) {
  return verified ? (
    <span className="inline-flex items-center gap-1 text-xs font-normal text-emerald-600 dark:text-emerald-400">
      <BadgeCheck className="size-3.5" /> Vérifié
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-normal text-amber-600 dark:text-amber-400">
      <TriangleAlert className="size-3.5" /> Non vérifié
    </span>
  );
}

export function ProfileInfo() {
  const auth = useAuth();
  const { user } = useSession();
  const [profile, setProfile] = useState<CurrentUser | null>(null);

  useEffect(() => {
    let cancelled = false;
    auth
      .me()
      .then((current) => {
        if (!cancelled) setProfile(current);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [auth]);

  if (!user) return null;

  const needsVerification = user.role === "SELLER" || user.role === "RIDER";

  return (
    <div className="grid gap-6">
      <dl className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom complet" className="sm:col-span-2">
          {user.name}
        </Field>

        <Field label="Adresse e-mail">
          {user.email ? (
            <>
              <span className="truncate">{user.email}</span>
              {profile ? (
                <VerifiedBadge verified={profile.emailVerified} />
              ) : (
                <Skeleton className="h-4 w-16" />
              )}
            </>
          ) : (
            <span className="font-normal text-muted-foreground">Non renseignée</span>
          )}
        </Field>

        <Field label="Téléphone">
          {user.phone ? (
            <>
              <span>{user.phone}</span>
              {profile ? (
                <VerifiedBadge verified={profile.phoneVerified} />
              ) : (
                <Skeleton className="h-4 w-16" />
              )}
            </>
          ) : (
            <span className="font-normal text-muted-foreground">Non renseigné</span>
          )}
        </Field>

        <Field label="Rôle">{ROLE_LABELS[user.role] ?? user.role}</Field>

        {needsVerification && (
          <Field label="Vérification d’identité">
            {profile ? (
              (VERIFICATION_LABELS[profile.verificationStatus] ?? profile.verificationStatus)
            ) : (
              <Skeleton className="h-4 w-28" />
            )}
          </Field>
        )}

        <Field label="Membre depuis">
          {profile ? formatDate(profile.createdAt) : <Skeleton className="h-4 w-28" />}
        </Field>

        <Field label="Dernière connexion">
          {profile ? formatDate(profile.lastLoginAt) : <Skeleton className="h-4 w-28" />}
        </Field>
      </dl>

      <p className="text-xs text-muted-foreground">
        La modification de ces informations sera bientôt disponible.
      </p>
    </div>
  );
}
