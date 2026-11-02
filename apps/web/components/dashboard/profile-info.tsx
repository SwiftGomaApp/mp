"use client";

import { useEffect, useState } from "react";
import { BadgeCheck, Download, Pencil, TriangleAlert } from "lucide-react";
import { useSession } from "swiftgoma-mp-auth/react";

import { AvatarEditor } from "@/components/dashboard/avatar-editor";
import { ContactChangeDialog } from "@/components/dashboard/contact-change-dialog";
import { DataExportDialog } from "@/components/dashboard/data-export-dialog";
import { EditNameDialog } from "@/components/dashboard/edit-name-dialog";
import { ROLE_LABELS } from "@/components/dashboard/user-display";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { auth } from "@/lib/auth";
import { setAvatarUrl } from "@/lib/avatar-store";
import { type ContactKind, type UserProfile, usersApi } from "@/lib/users-api";

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
      <dd className="flex min-h-6 items-center gap-2 text-sm font-medium wrap-break-word">
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
  const { user } = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [lastLoginAt, setLastLoginAt] = useState<string | null | undefined>(undefined);
  const [nameOpen, setNameOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [contactKind, setContactKind] = useState<ContactKind | null>(null);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .getProfile()
      .then((current) => {
        if (cancelled) return;
        setProfile(current);
        setAvatarUrl(current.id, current.avatarUrl);
      })
      .catch(() => {});
    auth
      .me()
      .then((current) => {
        if (!cancelled) setLastLoginAt(current.lastLoginAt);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  if (!user) return null;

  const name = profile?.name ?? user.name;
  const email = profile ? profile.email : user.email;
  const phone = profile ? profile.phone : user.phone;
  const needsVerification = user.role === "SELLER" || user.role === "RIDER";

  /** Keeps the sidebar and header in sync with the new profile. */
  function applyProfile(next: UserProfile) {
    setProfile(next);
    setAvatarUrl(next.id, next.avatarUrl);
    void auth.me().catch(() => {});
  }

  async function saveName(next: string) {
    applyProfile(await usersApi.updateName(next));
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-xl border bg-card p-4">
        <AvatarEditor name={name} avatarUrl={profile?.avatarUrl ?? null} onChange={applyProfile} />
      </section>

      <dl className="grid gap-3 sm:grid-cols-2">
        <Field label="Nom complet" className="sm:col-span-2">
          <span className="min-w-0 flex-1 truncate">{name}</span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={!profile}
            onClick={() => setNameOpen(true)}
          >
            <Pencil />
            Modifier
          </Button>
        </Field>

        <Field label="Adresse e-mail">
          {email ? (
            <>
              <span className="truncate">{email}</span>
              {profile ? (
                <VerifiedBadge verified={profile.emailVerified} />
              ) : (
                <Skeleton className="h-4 w-16" />
              )}
            </>
          ) : (
            <span className="font-normal text-muted-foreground">Non renseignée</span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={!profile}
            onClick={() => setContactKind("EMAIL")}
          >
            <Pencil />
            {email ? "Modifier" : "Ajouter"}
          </Button>
        </Field>

        <Field label="Téléphone">
          {phone ? (
            <>
              <span>{phone}</span>
              {profile ? (
                <VerifiedBadge verified={profile.phoneVerified} />
              ) : (
                <Skeleton className="h-4 w-16" />
              )}
            </>
          ) : (
            <span className="font-normal text-muted-foreground">Non renseigné</span>
          )}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            disabled={!profile}
            onClick={() => setContactKind("PHONE")}
          >
            <Pencil />
            {phone ? "Modifier" : "Ajouter"}
          </Button>
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
          {lastLoginAt !== undefined ? formatDate(lastLoginAt) : <Skeleton className="h-4 w-28" />}
        </Field>
      </dl>

      <p className="text-xs text-muted-foreground">
        Changer votre e-mail ou votre téléphone demande un code de sécurité et la confirmation du
        nouveau contact.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="grid gap-0.5">
          <h2 className="font-semibold">Mes données</h2>
          <p className="text-sm text-muted-foreground">
            Téléchargez une copie des informations liées à votre compte.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <Download />
          Télécharger mes données
        </Button>
      </div>

      <DataExportDialog open={exportOpen} onOpenChange={setExportOpen} />

      <ContactChangeDialog
        open={contactKind !== null}
        onOpenChange={(next) => !next && setContactKind(null)}
        kind={contactKind ?? "EMAIL"}
        current={contactKind === "PHONE" ? phone : email}
        onChanged={applyProfile}
      />

      <EditNameDialog
        open={nameOpen}
        onOpenChange={setNameOpen}
        currentName={name}
        onSave={saveName}
      />
    </div>
  );
}
