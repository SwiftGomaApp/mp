"use client";

import { useState } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";

import { OTP_CODE_LENGTH, OtpCodeInput } from "@/components/auth/otp-code-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Mode = "app" | "backup";

const MIN_BACKUP_CODE_LENGTH = 8;

const toBackupCodeDigits = (value: string) => value.replace(/[^a-z0-9]/gi, "");

interface TwoFactorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
}

export function TwoFactorDialog({ open, onOpenChange, onVerified }: TwoFactorDialogProps) {
  const [mode, setMode] = useState<Mode>("app");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const isBackup = mode === "backup";
  const isValid = isBackup
    ? toBackupCodeDigits(backupCode).length >= MIN_BACKUP_CODE_LENGTH
    : code.length === OTP_CODE_LENGTH;

  function reset() {
    setMode("app");
    setCode("");
    setBackupCode("");
    setError(null);
  }

  function handleOpenChange(next: boolean) {
    if (isLoading) return;
    if (!next) reset();
    onOpenChange(next);
  }

  function switchMode() {
    setMode(isBackup ? "app" : "backup");
    setCode("");
    setBackupCode("");
    setError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || !isValid) return;
    setIsLoading(true);
    setError(null);
    try {
      // TODO: replace with the real two-step verification call from the auth package.
      await new Promise((resolve) => setTimeout(resolve, 1200));
      if (!isBackup && code === "000000") {
        setError("Code incorrect ou expiré. Réessayez avec le code actuel de votre application.");
        setCode("");
        return;
      }
      reset();
      onVerified();
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 p-7 sm:max-w-sm">
        <DialogHeader className="items-center gap-3 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
            <ShieldCheck className="size-5" />
          </div>
          <div className="grid gap-1">
            <DialogTitle className="text-lg font-semibold">Double vérification</DialogTitle>
            <DialogDescription className="text-xs">
              {isBackup
                ? "Saisissez l’un des codes de secours remis lors de l’activation. Chaque code ne sert qu’une fois."
                : "Ouvrez votre application d’authentification et saisissez le code à 6 chiffres affiché pour SwiftGoma."}
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col items-center gap-4">
          {isBackup ? (
            <Input
              key="backup"
              name="backup-code"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              placeholder="XXXX-XXXX"
              aria-label="Code de secours"
              aria-invalid={error ? true : undefined}
              value={backupCode}
              onChange={(event) => {
                setBackupCode(event.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, ""));
                setError(null);
              }}
              disabled={isLoading}
              autoFocus
              className="h-11 text-center font-mono text-base tracking-widest uppercase"
            />
          ) : (
            <OtpCodeInput
              key="app"
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

          {error && (
            <p
              role="alert"
              className="flex items-start gap-1.5 text-center text-xs text-destructive"
            >
              <TriangleAlert className="mt-px size-3.5 shrink-0" />
              {error}
            </p>
          )}

          <Button
            type="submit"
            variant={isValid ? "default" : "secondary"}
            size="lg"
            className="w-full"
            disabled={isLoading || !isValid}
          >
            {isLoading && <Spinner data-icon="inline-start" />}
            {isLoading ? "Vérification…" : "Vérifier"}
          </Button>
        </form>

        <div className="flex flex-col items-center gap-2 text-xs text-muted-foreground">
          <button
            type="button"
            onClick={switchMode}
            disabled={isLoading}
            className="font-medium text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:text-primary disabled:pointer-events-none disabled:opacity-50"
          >
            {isBackup
              ? "Utiliser mon application d’authentification"
              : "Utiliser un code de secours"}
          </button>
          <button
            type="button"
            onClick={() => handleOpenChange(false)}
            disabled={isLoading}
            className="underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline disabled:pointer-events-none disabled:opacity-50"
          >
            Annuler
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
