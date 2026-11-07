"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Check, Clock, LogOut, RotateCcw, ShieldAlert } from "lucide-react";

import { useLogout } from "@/components/auth/logout-screen";
import { DOCUMENT_COPY, SellerVerification } from "@/components/dashboard/seller-verification";
import { ErrorText } from "@/components/security/recovery-codes-step";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { authErrorMessage } from "@/lib/auth-errors";
import { type MyVerification, verificationApi } from "@/lib/verification-api";
import { setVerificationScreenActive } from "@/lib/verification-screen";
import { Reveal } from "@/components/global/reveal";
import { cn } from "cn";

const POLL_MS = 60_000;

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" });
const formatDate = (iso: string | null | undefined) =>
  iso ? dateFormatter.format(new Date(iso)) : null;

const LEGAL_LINKS = [
  { href: "/legale/privacy", label: "Politique de confidentialité" },
  { href: "/legale/seller-terms", label: "Conditions vendeur" },
];

/** Full page, outside the dashboard: the seller can only finish the file or sign out. */
function Screen({ children }: { children: React.ReactNode }) {
  const { logout, isLoggingOut } = useLogout();

  useEffect(() => {
    setVerificationScreenActive(true);
    return () => setVerificationScreenActive(false);
  }, []);

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <main className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6 sm:py-14">
        <div className="flex w-full max-w-2xl flex-col gap-6">
          {children}
          <Reveal delay={300}>
            <div className="flex justify-center border-t pt-6">
              <Button variant="ghost" size="sm" onClick={logout} disabled={isLoggingOut}>
                {isLoggingOut ? <Spinner data-icon="inline-start" /> : <LogOut />}
                Se déconnecter
              </Button>
            </div>
          </Reveal>
        </div>
      </main>
      <nav
        aria-label="Informations légales"
        className="flex flex-wrap justify-center gap-x-5 gap-y-1 px-4 pb-6 text-xs text-muted-foreground"
      >
        {LEGAL_LINKS.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:text-foreground focus-visible:underline"
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

/** Same layout as the screens that follow, so nothing jumps when the data arrives. */
function VerificationSkeleton() {
  return (
    <div className="grid gap-6" aria-busy="true" aria-label="Chargement de la vérification">
      <div className="flex flex-col items-center gap-3">
        <Skeleton className="size-14 rounded-full" />
        <Skeleton className="h-7 w-64 max-w-full" />
        <Skeleton className="h-4 w-80 max-w-full" />
        <Skeleton className="h-4 w-56 max-w-full" />
      </div>
      <div className="grid gap-3 rounded-xl border bg-card p-4">
        <Skeleton className="h-4 w-32" />
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center gap-2">
            <Skeleton className="size-4 rounded-full" />
            <Skeleton className="h-4 w-48 max-w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-52 justify-self-center rounded-lg" />
    </div>
  );
}

function PendingScreen({
  data,
  onRefresh,
  isRefreshing,
}: {
  data: MyVerification;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  const inReview = data.verificationStatus === "IN_REVIEW";
  const steps = [
    {
      label: "Dossier envoyé",
      detail: formatDate(data.case?.submittedAt) ?? "Reçu",
      state: "done",
    },
    {
      label: "Examen par notre équipe",
      detail: inReview ? "En cours" : "Dès que possible",
      state: inReview ? "current" : "upcoming",
    },
    { label: "Décision", detail: "Vous serez prévenu", state: "upcoming" },
  ] as const;

  return (
    <Screen>
      <Reveal>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
            <Clock className="size-7" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">Dossier en cours d’examen</h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Merci ! Nous vérifions vos documents. Cela prend en général quelques jours. Vous pourrez
            accéder à votre espace vendeur dès l’approbation.
          </p>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <ol className="grid gap-0 rounded-xl border bg-card p-4">
          {steps.map((item, index) => (
            <li key={item.label} className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full",
                    item.state === "done" &&
                      "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                    item.state === "current" && "bg-primary text-primary-foreground",
                    item.state === "upcoming" && "bg-muted text-muted-foreground",
                  )}
                >
                  {item.state === "done" ? (
                    <Check className="size-4" />
                  ) : item.state === "current" ? (
                    <Spinner className="size-4" />
                  ) : (
                    <span className="text-xs font-semibold">{index + 1}</span>
                  )}
                </span>
                {index < steps.length - 1 && <span className="my-1 w-px flex-1 bg-border" />}
              </div>
              <div className={cn("grid gap-0.5 pb-5", index === steps.length - 1 && "pb-0")}>
                <p className="text-sm font-semibold">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </Reveal>

      <Reveal delay={200}>
        <div className="flex justify-center">
          <Button variant="outline" size="sm" onClick={onRefresh} disabled={isRefreshing}>
            {isRefreshing && <Spinner data-icon="inline-start" />}
            Actualiser
          </Button>
        </div>
      </Reveal>
    </Screen>
  );
}

function IntroScreen({
  data,
  onStart,
  isStarting,
  error,
}: {
  data: MyVerification;
  onStart: () => void;
  isStarting: boolean;
  error: string | null;
}) {
  const status = data.verificationStatus;
  const rejected = status === "REJECTED";
  const expired = status === "EXPIRED";
  const exhausted = rejected && data.attemptsLeft === 0;
  const Icon = rejected || expired ? ShieldAlert : BadgeCheck;
  const required = data.checklist?.required ?? [];

  return (
    <Screen>
      <Reveal>
        <div className="flex flex-col items-center gap-3 text-center">
          <span
            className={cn(
              "flex size-14 items-center justify-center rounded-full ring-8",
              rejected || expired
                ? "bg-destructive/10 text-destructive ring-destructive/5"
                : "bg-primary/10 text-primary ring-primary/5",
            )}
          >
            <Icon className="size-7" />
          </span>
          <h1 className="text-2xl font-bold tracking-tight">
            {rejected
              ? "Votre dossier a été refusé"
              : expired
                ? "Un de vos documents a expiré"
                : "Vérifiez votre identité pour vendre"}
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            {rejected
              ? [
                  data.case?.decisionNote,
                  exhausted
                    ? "Vous avez utilisé vos 3 essais. Contactez le Support."
                    : `Il vous reste ${data.attemptsLeft} essai${data.attemptsLeft > 1 ? "s" : ""}.`,
                ]
                  .filter(Boolean)
                  .join(" ")
              : expired
                ? "Renvoyez un dossier à jour pour retrouver l’accès à votre espace vendeur."
                : "Pour publier vos produits et recevoir vos paiements, nous devons d’abord vérifier votre identité."}
          </p>
        </div>
      </Reveal>

      {!exhausted && (
        <>
          <Reveal delay={100}>
            <section className="grid gap-3 rounded-xl border bg-card p-4">
              <h2 className="text-sm font-semibold">Ce qu’il vous faut</h2>
              <ul className="grid gap-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <Check className="size-4 text-primary" />
                  Votre numéro d’impôt (NIF), si vous en avez un
                </li>
                {required.map((item) => (
                  <li key={item.type} className="flex items-center gap-2">
                    <Check className="size-4 text-primary" />
                    {DOCUMENT_COPY[item.type].title}
                  </li>
                ))}
              </ul>
            </section>
          </Reveal>

          {error && <ErrorText>{error}</ErrorText>}

          <Reveal delay={200}>
            <div className="flex justify-center">
              <Button onClick={onStart} disabled={isStarting}>
                {isStarting ? (
                  <Spinner data-icon="inline-start" />
                ) : rejected ? (
                  <RotateCcw />
                ) : null}
                {rejected ? "Recommencer" : "Commencer ma vérification"}
              </Button>
            </div>
          </Reveal>
        </>
      )}
    </Screen>
  );
}

/** Shows the seller area only once the identity file is approved. */
export function SellerVerificationGate({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<MyVerification | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStarting, setIsStarting] = useState(false);

  const refresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      setData(await verificationApi.getMine());
      setError(null);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    verificationApi
      .getMine()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const status = data?.verificationStatus;
  const isWaiting = status === "PENDING" || status === "IN_REVIEW";

  // The decision comes from the Support: check back by ourselves.
  useEffect(() => {
    if (!isWaiting) return;
    const timer = setInterval(() => void refresh(), POLL_MS);
    return () => clearInterval(timer);
  }, [isWaiting, refresh]);

  async function start() {
    if (isStarting) return;
    setIsStarting(true);
    setError(null);
    try {
      await verificationApi.start();
      setData(await verificationApi.getMine());
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsStarting(false);
    }
  }

  if (!data) {
    return (
      <Screen>
        {error ? (
          <>
            <ErrorText>{error}</ErrorText>
            <Button
              variant="outline"
              className="justify-self-center"
              onClick={() => void refresh()}
            >
              Réessayer
            </Button>
          </>
        ) : (
          <VerificationSkeleton />
        )}
      </Screen>
    );
  }

  if (status === "APPROVED") return <>{children}</>;

  if (isWaiting) {
    return (
      <PendingScreen data={data} onRefresh={() => void refresh()} isRefreshing={isRefreshing} />
    );
  }

  if (data.case?.status === "NOT_SUBMITTED") {
    return (
      <Screen>
        <SellerVerification data={data} onChange={setData} />
      </Screen>
    );
  }

  return (
    <IntroScreen data={data} onStart={() => void start()} isStarting={isStarting} error={error} />
  );
}
