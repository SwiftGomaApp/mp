"use client";

import { useEffect, useState } from "react";
import { ShieldCheck, TriangleAlert } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import type { AuthUser, TwoFactorSetup } from "swiftgoma-mp-auth";

import { OTP_CODE_LENGTH, OtpCodeInput } from "@/components/auth/otp-code-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";

interface EnrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDone: (user: AuthUser) => Promise<boolean>;
}

/** First sign-in of a staff account: two-step verification is mandatory and set up here. */
export function EnrollDialog({ open, onOpenChange, onDone }: EnrollDialogProps) {
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [done, setDone] = useState<{ user: AuthUser; backupCodes: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    auth.twoFactor.enroll
      .start()
      .then((result) => !cancelled && setSetup(result))
      .catch((err: unknown) => !cancelled && setError(authErrorMessage(err)));
    return () => {
      cancelled = true;
    };
  }, [open]);

  function handleOpenChange(next: boolean) {
    if (isLoading || done) return;
    if (!next) {
      setSetup(null);
      setCode("");
      setError(null);
    }
    onOpenChange(next);
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || code.length !== OTP_CODE_LENGTH) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await auth.twoFactor.enroll.confirm({ code });
      if (result.backupCodes.length) setDone({ user: result.user, backupCodes: result.backupCodes });
      else if (await onDone(result.user)) onOpenChange(false);
    } catch (err) {
      setError(authErrorMessage(err));
      setCode("");
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
            <DialogTitle className="text-lg font-semibold">Activer la double vérification</DialogTitle>
            <DialogDescription className="text-xs">
              {done
                ? "Conservez ces codes de secours : ils ne seront plus affichés. Chacun ne sert qu’une fois."
                : "Obligatoire pour le personnel. Scannez le code avec votre application d’authentification, puis saisissez le code à 6 chiffres."}
            </DialogDescription>
          </div>
        </DialogHeader>

        {done ? (
          <div className="grid gap-4">
            <ul className="grid grid-cols-2 gap-2 font-mono text-sm">
              {done.backupCodes.map((backup) => (
                <li key={backup} className="rounded-md bg-muted px-2 py-1.5 text-center">
                  {backup}
                </li>
              ))}
            </ul>
            <Button
              size="lg"
              onClick={async () => {
                if (await onDone(done.user)) {
                  setDone(null);
                  onOpenChange(false);
                }
              }}
            >
              J’ai conservé mes codes
            </Button>
          </div>
        ) : (
          <form onSubmit={confirm} className="flex flex-col items-center gap-4">
            {setup ? (
              <>
                <div className="rounded-lg bg-white p-3">
                  <QRCodeSVG value={setup.otpauthUri} size={152} />
                </div>
                <p className="font-mono text-xs break-all text-muted-foreground">{setup.secret}</p>
                <OtpCodeInput
                  value={code}
                  onChange={(value) => {
                    setCode(value);
                    setError(null);
                  }}
                  disabled={isLoading}
                  invalid={!!error}
                  aria-label="Code de l’application d’authentification"
                />
              </>
            ) : (
              !error && <Spinner />
            )}
            {error && (
              <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
                <TriangleAlert className="mt-px size-3.5 shrink-0" />
                {error}
              </p>
            )}
            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={isLoading || code.length !== OTP_CODE_LENGTH}
            >
              {isLoading && <Spinner data-icon="inline-start" />}
              Activer et continuer
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
