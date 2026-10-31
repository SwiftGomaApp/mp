"use client";

import { useEffect, useState } from "react";
import { Mail, MailCheck, Phone, Plus, ShieldCheck, Trash2 } from "lucide-react";
import type { ContactKind, RecoveryContacts } from "swiftgoma-mp-auth/account";

import { OTP_CODE_LENGTH, OtpCodeInput } from "@/components/auth/otp-code-input";
import { ErrorText } from "@/components/security/recovery-codes-step";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { account } from "@/lib/account";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { isValidEmail } from "@/lib/auth-flow";

type View = "list" | "add" | "identity" | "verify";
type Pending = { action: "add" } | { action: "remove"; kind: ContactKind };

const KIND_COPY = {
  EMAIL: { label: "E-mail de secours", icon: Mail, placeholder: "secours@exemple.com" },
  PHONE: { label: "Téléphone de secours", icon: Phone, placeholder: "+243 970 000 000" },
} as const;

const isValidPhone = (value: string) => /^\+\d{8,15}$/.test(value.replace(/[\s.-]/g, ""));
const normalize = (kind: ContactKind, value: string) =>
  kind === "PHONE" ? value.replace(/[\s.-]/g, "") : value.trim();

interface RecoveryContactsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RecoveryContactsDialog(props: RecoveryContactsDialogProps) {
  return props.open ? <RecoveryContactsFlow {...props} /> : null;
}

function RecoveryContactsFlow({ open, onOpenChange }: RecoveryContactsDialogProps) {
  const [view, setView] = useState<View>("list");
  const [contacts, setContacts] = useState<RecoveryContacts | null>(null);
  const [kind, setKind] = useState<ContactKind>("EMAIL");
  const [value, setValue] = useState("");
  const [pending, setPending] = useState<Pending>({ action: "add" });
  const [usesAuthenticator, setUsesAuthenticator] = useState<boolean | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [stepUpCode, setStepUpCode] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    account.recoveryContacts
      .list()
      .then((result) => {
        if (!cancelled) setContacts(result);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const normalized = normalize(kind, value);
  const isContactValid = kind === "EMAIL" ? isValidEmail(normalized) : isValidPhone(normalized);

  function goTo(next: View) {
    (setView(next), setError(null));
  }

  async function beginIdentity(next: Pending) {
    (setPending(next),
      setStepUpCode(""),
      setSentTo(null),
      setUsesAuthenticator(null),
      goTo("identity"));
    try {
      const { enabled } = await account.twoFactor.status();
      setUsesAuthenticator(enabled);
      if (!enabled) setSentTo((await auth.stepUp.request()).target);
    } catch (err) {
      setError(authErrorMessage(err));
    }
  }

  async function run(task: () => Promise<void>) {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  const handleIdentity = () =>
    run(async () => {
      if (pending.action === "add") {
        await account.recoveryContacts.requestCode({ kind, value: normalized, stepUpCode });
        setCode("");
        goTo("verify");
      } else {
        setContacts(await account.recoveryContacts.remove({ kind: pending.kind, stepUpCode }));
        goTo("list");
      }
    });

  const handleVerify = () =>
    run(async () => {
      await account.recoveryContacts.verify({ kind, value: normalized, code });
      setContacts(await account.recoveryContacts.list());
      setValue("");
      goTo("list");
    });

  const rows = [
    {
      kind: "EMAIL" as const,
      value: contacts?.secondaryEmail ?? null,
      verified: !!contacts?.secondaryEmailVerifiedAt,
    },
    {
      kind: "PHONE" as const,
      value: contacts?.secondaryPhone ?? null,
      verified: !!contacts?.secondaryPhoneVerifiedAt,
    },
  ];
  const canAdd = rows.some((row) => !row.value);
  const identityReady = usesAuthenticator === true || sentTo !== null;

  return (
    <Dialog open={open} onOpenChange={(next) => !isLoading && onOpenChange(next)}>
      <DialogContent className="gap-5 sm:max-w-md">
        {view === "list" && (
          <>
            <DialogHeader>
              <DialogTitle>Contact de récupération</DialogTitle>
              <DialogDescription>
                Si vous perdez l’accès à votre compte, nous pourrons vous joindre ici pour le
                récupérer.
              </DialogDescription>
            </DialogHeader>

            {error && <ErrorText>{error}</ErrorText>}

            <ul className="grid gap-2">
              {!contacts && !error && <Skeleton className="h-16 w-full rounded-xl" />}
              {contacts &&
                rows
                  .filter((row) => row.value)
                  .map(({ kind: rowKind, value: rowValue, verified }) => {
                    const { label, icon: Icon } = KIND_COPY[rowKind];
                    return (
                      <li key={rowKind} className="flex items-center gap-3 rounded-xl border p-3">
                        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                          <Icon className="size-5" />
                        </span>
                        <div className="grid min-w-0 flex-1 gap-0.5">
                          <p className="text-sm font-medium">{label}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {rowValue}
                            {!verified && " · non vérifié"}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Supprimer ${label}`}
                          onClick={() => beginIdentity({ action: "remove", kind: rowKind })}
                        >
                          <Trash2 />
                        </Button>
                      </li>
                    );
                  })}
            </ul>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
              {contacts && canAdd && (
                <Button
                  onClick={() => {
                    setKind(contacts.secondaryEmail ? "PHONE" : "EMAIL");
                    setValue("");
                    goTo("add");
                  }}
                >
                  <Plus />
                  Ajouter un contact
                </Button>
              )}
            </DialogFooter>
          </>
        )}

        {view === "add" && (
          <>
            <DialogHeader>
              <DialogTitle>Ajouter un contact de récupération</DialogTitle>
              <DialogDescription>
                Utilisez une adresse ou un numéro différent de ceux de votre compte.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                {(["EMAIL", "PHONE"] as const).map((option) => {
                  const taken =
                    option === "EMAIL" ? !!contacts?.secondaryEmail : !!contacts?.secondaryPhone;
                  const Icon = KIND_COPY[option].icon;
                  return (
                    <Button
                      key={option}
                      type="button"
                      variant={kind === option ? "default" : "outline"}
                      disabled={taken}
                      onClick={() => {
                        setKind(option);
                        setValue("");
                      }}
                    >
                      <Icon />
                      {option === "EMAIL" ? "E-mail" : "Téléphone"}
                    </Button>
                  );
                })}
              </div>
              <Input
                type={kind === "EMAIL" ? "email" : "tel"}
                inputMode={kind === "EMAIL" ? "email" : "tel"}
                autoComplete="off"
                autoFocus
                placeholder={KIND_COPY[kind].placeholder}
                value={value}
                onChange={(event) => setValue(event.target.value)}
                className="h-10"
              />
              {kind === "PHONE" && (
                <p className="text-xs text-muted-foreground">
                  Format international, par exemple +243 970 000 000.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => goTo("list")}>
                Retour
              </Button>
              <Button disabled={!isContactValid} onClick={() => beginIdentity({ action: "add" })}>
                Continuer
              </Button>
            </DialogFooter>
          </>
        )}

        {view === "identity" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirmez que c’est bien vous</DialogTitle>
              <DialogDescription>
                {usesAuthenticator
                  ? "Saisissez le code de votre application d’authentification."
                  : sentTo
                    ? `Saisissez le code envoyé à ${sentTo}.`
                    : "Nous vous envoyons un code de vérification…"}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
                <ShieldCheck className="size-5" />
              </span>
              <OtpCodeInput
                value={stepUpCode}
                onChange={(next) => {
                  setStepUpCode(next);
                  setError(null);
                }}
                disabled={isLoading || !identityReady}
                invalid={!!error}
                autoFocus
                aria-label="Code de vérification"
              />
              {error && <ErrorText>{error}</ErrorText>}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => goTo(pending.action === "add" ? "add" : "list")}
                disabled={isLoading}
              >
                Retour
              </Button>
              <Button
                variant={pending.action === "remove" ? "destructive" : "default"}
                onClick={handleIdentity}
                disabled={isLoading || stepUpCode.length !== OTP_CODE_LENGTH}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                {pending.action === "remove" ? "Supprimer" : "Envoyer le code"}
              </Button>
            </DialogFooter>
          </>
        )}

        {view === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle>Vérifiez votre contact</DialogTitle>
              <DialogDescription>Saisissez le code envoyé à {normalized}.</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
                <MailCheck className="size-5" />
              </span>
              <OtpCodeInput
                value={code}
                onChange={(next) => {
                  setCode(next);
                  setError(null);
                }}
                disabled={isLoading}
                invalid={!!error}
                autoFocus
                aria-label="Code envoyé au contact de récupération"
              />
              {error && <ErrorText>{error}</ErrorText>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => goTo("add")} disabled={isLoading}>
                Retour
              </Button>
              <Button
                onClick={handleVerify}
                disabled={isLoading || code.length !== OTP_CODE_LENGTH}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                Vérifier
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
