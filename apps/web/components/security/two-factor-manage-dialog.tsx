"use client";

import { useEffect, useState } from "react";
import { ChevronRight, KeyRound, ShieldOff, ShieldCheck } from "lucide-react";

import { OTP_CODE_LENGTH, OtpCodeInput } from "@/components/auth/otp-code-input";
import { ErrorText, RecoveryCodesStep } from "@/components/security/recovery-codes-step";
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
import { authErrorMessage } from "@/lib/auth-errors";

type Action = "regenerate" | "disable";
type View = "menu" | Action | "codes";

interface Status {
  mandatory: boolean;
  backupCodesRemaining: number;
}

interface TwoFactorManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the two-step verification was turned off. */
  onDisabled: () => void;
}

const ACTION_COPY: Record<Action, { title: string; description: string; submit: string }> = {
  regenerate: {
    title: "Générer de nouveaux codes",
    description:
      "Vos anciens codes de récupération seront invalidés. Confirmez avec un code de votre application d’authentification.",
    submit: "Générer les codes",
  },
  disable: {
    title: "Désactiver la double vérification",
    description:
      "Votre compte sera moins protégé : un mot de passe ou un code reçu suffira pour vous connecter. Confirmez avec un code de votre application d’authentification.",
    submit: "Désactiver",
  },
};

export function TwoFactorManageDialog(props: TwoFactorManageDialogProps) {
  return props.open ? <TwoFactorManageFlow {...props} /> : null;
}

function TwoFactorManageFlow({ open, onOpenChange, onDisabled }: TwoFactorManageDialogProps) {
  const [view, setView] = useState<View>("menu");
  const [status, setStatus] = useState<Status | null>(null);
  const [useBackupCode, setUseBackupCode] = useState(false);
  const [code, setCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    account.twoFactor
      .status()
      .then((result) => {
        if (!cancelled) setStatus(result);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isCodeValid = useBackupCode ? code.trim().length > 0 : code.length === OTP_CODE_LENGTH;

  function goTo(next: View) {
    setView(next);
    setCode("");
    setUseBackupCode(false);
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    // The new codes are shown once: do not let a stray click close the dialog before they are saved.
    if (isLoading || (view === "codes" && !saved)) return;
    onOpenChange(next);
  }

  async function handleSubmit(action: Action) {
    if (isLoading || !isCodeValid) return;
    const factor = useBackupCode ? { backupCode: code.trim() } : { code };
    setIsLoading(true);
    setError(null);
    try {
      if (action === "disable") {
        await account.twoFactor.disable(factor);
        onOpenChange(false);
        onDisabled();
        return;
      }
      const result = await account.twoFactor.regenerateBackupCodes(factor);
      setBackupCodes(result.backupCodes);
      setStatus((current) =>
        current ? { ...current, backupCodesRemaining: result.backupCodes.length } : current,
      );
      setView("codes");
    } catch (err) {
      setError(authErrorMessage(err));
      setCode("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 sm:max-w-md" showCloseButton={view !== "codes"}>
        {view === "menu" && (
          <>
            <DialogHeader>
              <DialogTitle>Double vérification</DialogTitle>
              <DialogDescription>
                Votre compte est protégé par une application d’authentification.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-3 rounded-xl border bg-emerald-500/5 p-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <ShieldCheck className="size-5" />
              </span>
              <div className="grid gap-0.5">
                <p className="text-sm font-semibold">Application d’authentification</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400">Activée</p>
              </div>
            </div>

            {error && <ErrorText>{error}</ErrorText>}

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => goTo("regenerate")}
                disabled={!status}
                className="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60"
              >
                <KeyRound className="size-5 shrink-0 text-muted-foreground" />
                <span className="grid flex-1 gap-0.5">
                  <span className="text-sm font-medium">Codes de récupération</span>
                  <span className="text-xs text-muted-foreground">
                    {status ? (
                      `${status.backupCodesRemaining} code${status.backupCodesRemaining > 1 ? "s" : ""} restant${status.backupCodesRemaining > 1 ? "s" : ""} · Générer de nouveaux codes`
                    ) : (
                      <Skeleton className="h-3 w-40" />
                    )}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>

              {status && !status.mandatory && (
                <button
                  type="button"
                  onClick={() => goTo("disable")}
                  className="flex items-center gap-3 rounded-xl border p-3 text-left text-destructive transition-colors outline-none hover:bg-destructive/5 focus-visible:ring-3 focus-visible:ring-destructive/30"
                >
                  <ShieldOff className="size-5 shrink-0" />
                  <span className="grid flex-1 gap-0.5">
                    <span className="text-sm font-medium">Désactiver la double vérification</span>
                    <span className="text-xs text-muted-foreground">
                      Retirer la protection de l’application d’authentification
                    </span>
                  </span>
                  <ChevronRight className="size-4 shrink-0" />
                </button>
              )}

              {status?.mandatory && (
                <p className="text-xs text-muted-foreground">
                  La double vérification est obligatoire pour ce compte et ne peut pas être
                  désactivée.
                </p>
              )}
            </div>
          </>
        )}

        {(view === "regenerate" || view === "disable") && (
          <>
            <DialogHeader>
              <DialogTitle>{ACTION_COPY[view].title}</DialogTitle>
              <DialogDescription>{ACTION_COPY[view].description}</DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-3">
              {useBackupCode ? (
                <Input
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value);
                    setError(null);
                  }}
                  placeholder="xxxxxxxx-xxxxxxxx"
                  autoComplete="off"
                  autoFocus
                  disabled={isLoading}
                  aria-label="Code de récupération"
                  className="h-10 text-center font-mono"
                />
              ) : (
                <OtpCodeInput
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    setError(null);
                  }}
                  disabled={isLoading}
                  invalid={!!error}
                  autoFocus
                  aria-label="Code de l’application d’authentification"
                />
              )}
              {error && <ErrorText>{error}</ErrorText>}
              <button
                type="button"
                onClick={() => {
                  setUseBackupCode((current) => !current);
                  setCode("");
                  setError(null);
                }}
                className="text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
              >
                {useBackupCode
                  ? "Utiliser un code de l’application"
                  : "Utiliser un code de récupération"}
              </button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => goTo("menu")} disabled={isLoading}>
                Retour
              </Button>
              <Button
                variant={view === "disable" ? "destructive" : "default"}
                onClick={() => handleSubmit(view)}
                disabled={isLoading || !isCodeValid}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                {ACTION_COPY[view].submit}
              </Button>
            </DialogFooter>
          </>
        )}

        {view === "codes" && (
          <RecoveryCodesStep
            codes={backupCodes}
            saved={saved}
            onSavedChange={setSaved}
            onFinish={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
