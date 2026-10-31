"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, TriangleAlert } from "lucide-react";
import type { ActivityCategory, ActivityItem } from "swiftgoma-mp-auth/account";

import { formatDateTime, formatPlace } from "@/components/dashboard/format-date";
import { ErrorText } from "@/components/security/recovery-codes-step";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { account } from "@/lib/account";
import { authErrorMessage } from "@/lib/auth-errors";
import { cn } from "cn";

const PAGE_SIZE = 20;

const FILTERS: { value: ActivityCategory | "ALL"; label: string }[] = [
  { value: "ALL", label: "Tout" },
  { value: "LOGIN", label: "Connexions" },
  { value: "DEVICE", label: "Appareils" },
  { value: "SECURITY", label: "Sécurité" },
];

const EVENT_LABELS: Record<string, string> = {
  LOGIN_SUCCESS: "Connexion réussie",
  LOGIN_FAILED: "Échec de connexion",
  LOGOUT: "Déconnexion",
  LOGOUT_ALL: "Déconnexion de tous les appareils",
  NEW_DEVICE: "Nouvel appareil",
  SESSION_REVOKED: "Session fermée",
  SESSION_EVICTED: "Session remplacée",
  TOKEN_REUSE_DETECTED: "Session suspecte fermée",
  SIGNUP_STARTED: "Inscription commencée",
  SIGNUP_COMPLETED: "Compte créé",
  OTP_REQUESTED: "Code de vérification demandé",
  OTP_FAILED: "Code de vérification incorrect",
  STEP_UP_VERIFIED: "Identité confirmée",
  PASSWORD_SET: "Mot de passe ajouté",
  PASSWORD_CHANGED: "Mot de passe modifié",
  PASSWORD_REMOVED: "Mot de passe supprimé",
  PASSWORD_RESET_REQUESTED: "Réinitialisation du mot de passe demandée",
  PASSWORD_RESET_COMPLETED: "Mot de passe réinitialisé",
  PASSKEY_ADDED: "Clé d’accès ajoutée",
  PASSKEY_RENAMED: "Clé d’accès renommée",
  PASSKEY_REMOVED: "Clé d’accès supprimée",
  TOTP_ENABLED: "Double vérification activée",
  TOTP_DISABLED: "Double vérification désactivée",
  TOTP_FAILED: "Code d’authentification incorrect",
  BACKUP_CODES_GENERATED: "Nouveaux codes de récupération",
  BACKUP_CODE_USED: "Code de récupération utilisé",
  OAUTH_ACCOUNT_LINKED: "Compte lié",
  LOGIN_METHOD_REMOVED: "Méthode de connexion retirée",
  ACCOUNT_RECOVERY_REQUESTED: "Récupération du compte demandée",
  ACCOUNT_RECOVERY_COMPLETED: "Compte récupéré",
  ACCOUNT_RECOVERY_CANCELLED: "Récupération du compte annulée",
  ACCOUNT_LOCKED: "Compte verrouillé",
  ACCOUNT_SUSPENDED: "Compte suspendu",
  ACCOUNT_REACTIVATED: "Compte réactivé",
  SUPPORT_REQUEST_CREATED: "Demande envoyée au Support",
  SUPPORT_REQUEST_CLOSED: "Demande au Support clôturée",
};

const METHOD_LABELS: Record<string, string> = {
  EMAIL: "E-mail",
  PHONE: "Téléphone",
  PASSWORD: "Mot de passe",
  GOOGLE: "Google",
  APPLE: "Apple",
  PASSKEY: "Clé d’accès",
  TOTP: "Application d’authentification",
  BACKUP_CODE: "Code de récupération",
};

/** "SOME_EVENT" becomes "Some event" for events this screen does not know yet. */
const humanize = (value: string) => {
  const text = value.toLowerCase().replace(/_/g, " ");
  return text.charAt(0).toUpperCase() + text.slice(1);
};

export function ActivityOverview() {
  const [filter, setFilter] = useState<ActivityCategory | "ALL">("ALL");
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((category: ActivityCategory | "ALL", nextPage: number) => {
    return account.activity({
      page: nextPage,
      limit: PAGE_SIZE,
      ...(category !== "ALL" && { category }),
    });
  }, []);

  // A new filter starts over from the first page.
  useEffect(() => {
    let cancelled = false;
    load(filter, 1)
      .then((result) => {
        if (cancelled) return;
        setItems(result.items);
        setPage(1);
        setTotal(result.total);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [filter, load]);

  function changeFilter(next: ActivityCategory | "ALL") {
    if (next === filter) return;
    setItems(null);
    setError(null);
    setFilter(next);
  }

  async function loadMore() {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setError(null);
    try {
      const result = await load(filter, page + 1);
      setItems((current) => [...(current ?? []), ...result.items]);
      setPage(result.page);
      setTotal(result.total);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="grid gap-3">
        <div className="grid gap-0.5">
          <h2 className="font-semibold">Activité du compte</h2>
          <p className="text-sm text-muted-foreground">
            Connexions, appareils et changements de sécurité récents.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrer l’activité">
          {FILTERS.map(({ value, label }) => (
            <Button
              key={value}
              size="sm"
              variant={filter === value ? "default" : "outline"}
              aria-pressed={filter === value}
              onClick={() => changeFilter(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </section>

      {error && <ErrorText>{error}</ErrorText>}

      <ul className="grid gap-2">
        {!items && !error && (
          <>
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </>
        )}

        {items?.length === 0 && (
          <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            Aucune activité pour le moment.
          </li>
        )}

        {items?.map((item) => {
          const place = formatPlace(item.city, item.country);
          const details = [
            item.method ? (METHOD_LABELS[item.method] ?? humanize(item.method)) : null,
            item.deviceName,
            place,
          ].filter(Boolean);

          return (
            <li key={item.id} className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <span
                className={cn(
                  "flex size-9 shrink-0 items-center justify-center rounded-lg",
                  item.success
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                    : "bg-destructive/10 text-destructive",
                )}
              >
                {item.success ? <Check className="size-4" /> : <TriangleAlert className="size-4" />}
              </span>
              <div className="grid min-w-0 flex-1 gap-0.5">
                <p className="truncate text-sm font-medium">
                  {EVENT_LABELS[item.event] ?? humanize(item.event)}
                </p>
                {details.length > 0 && (
                  <p className="truncate text-xs text-muted-foreground">{details.join(" · ")}</p>
                )}
              </div>
              <time
                dateTime={item.createdAt}
                className="shrink-0 text-right text-xs text-muted-foreground"
              >
                {formatDateTime(item.createdAt)}
              </time>
            </li>
          );
        })}
      </ul>

      {items && items.length < total && (
        <Button
          variant="outline"
          className="justify-self-center"
          onClick={loadMore}
          disabled={isLoadingMore}
        >
          {isLoadingMore && <Spinner data-icon="inline-start" />}
          Voir plus
        </Button>
      )}
    </div>
  );
}
