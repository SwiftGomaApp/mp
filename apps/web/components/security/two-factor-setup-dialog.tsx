"use client";

import { useEffect, useState } from "react";
import { Check, Copy, MailCheck } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";

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
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { account } from "@/lib/account";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";

type Step = "verify" | "scan" | "recovery";

interface Setup {
  secret: string;
  otpauthUri: string;
}

interface TwoFactorSetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the user has saved the recovery codes and closed the dialog. */
  onDone: () => void;
}

export function TwoFactorSetupDialog(props: TwoFactorSetupDialogProps) {
  return props.open ? <TwoFactorSetupFlow {...props} /> : null;
}

function TwoFactorSetupFlow({ open, onOpenChange, onDone }: TwoFactorSetupDialogProps) {
  const [step, setStep] = useState<Step>("verify");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [stepUpCode, setStepUpCode] = useState("");
  const [setup, setSetup] = useState<Setup | null>(null);
  const [appCode, setAppCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The flow is mounted only while open, so every opening starts fresh and sends the code.
  useEffect(() => {
    let cancelled = false;

    auth.stepUp
      .request()
      .then((sent) => {
        if (!cancelled) setSentTo(sent.target);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the text stays visible to copy by hand.
    }
  }

  async function handleVerify() {
    if (isLoading || stepUpCode.length !== OTP_CODE_LENGTH) return;
    setIsLoading(true);
    setError(null);
    try {
      setSetup(await account.twoFactor.setup());
      setStep("scan");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm() {
    if (isLoading || appCode.length !== OTP_CODE_LENGTH) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await account.twoFactor.confirm({ code: appCode, stepUpCode });
      setBackupCodes(result.backupCodes);
      setStep("recovery");
    } catch (err) {
      setError(authErrorMessage(err));
      setAppCode("");
    } finally {
      setIsLoading(false);
    }
  }

  function handleOpenChange(next: boolean) {
    // The codes are shown once: do not let a stray click close the dialog before they are saved.
    if (isLoading || (step === "recovery" && !saved)) return;
    onOpenChange(next);
  }

  function finish() {
    onOpenChange(false);
    onDone();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="gap-5 sm:max-w-md" showCloseButton={step !== "recovery"}>
        {step === "verify" && (
          <>
            <DialogHeader>
              <DialogTitle>Confirmez que c’est bien vous</DialogTitle>
              <DialogDescription>
                {sentTo
                  ? `Saisissez le code envoyé à ${sentTo} pour commencer la configuration.`
                  : "Nous vous envoyons un code de vérification…"}
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-4">
              <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
                <MailCheck className="size-5" />
              </span>
              <OtpCodeInput
                value={stepUpCode}
                onChange={setStepUpCode}
                disabled={isLoading || !sentTo}
                invalid={!!error}
                autoFocus
                aria-label="Code de vérification"
              />
              {error && <ErrorText>{error}</ErrorText>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Annuler
              </Button>
              <Button
                onClick={handleVerify}
                disabled={isLoading || stepUpCode.length !== OTP_CODE_LENGTH}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                Continuer
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "scan" && (
          <>
            <DialogHeader>
              <DialogTitle>Configurer l’application d’authentification</DialogTitle>
            </DialogHeader>

            <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
              <li>
                Installez une application d’authentification comme Google Authenticator, 1Password
                ou Microsoft Authenticator.
              </li>
              <li>Scannez le QR code ou saisissez la clé secrète.</li>
              <li>Saisissez le code à 6 chiffres affiché par l’application.</li>
            </ol>

            <div className="flex flex-col items-center gap-4 rounded-xl border bg-muted/30 p-4">
              {setup ? (
                <>
                  <div className="flex items-center gap-2">
                    <code className="font-mono text-xs break-all text-muted-foreground">
                      {setup.secret}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      aria-label="Copier la clé secrète"
                      onClick={() => copy(setup.secret)}
                    >
                      {copied ? <Check /> : <Copy />}
                    </Button>
                  </div>
                  <div className="rounded-lg bg-white p-3">
                    <QRCodeSVG value={setup.otpauthUri} size={176} />
                  </div>
                </>
              ) : (
                <Skeleton className="size-44" />
              )}
            </div>

            <div className="flex flex-col items-center gap-3">
              <OtpCodeInput
                value={appCode}
                onChange={(value) => {
                  setAppCode(value);
                  setError(null);
                }}
                disabled={isLoading}
                invalid={!!error}
                autoFocus
                aria-label="Code de l’application d’authentification"
              />
              {error && <ErrorText>{error}</ErrorText>}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Annuler
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isLoading || appCode.length !== OTP_CODE_LENGTH}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                Activer
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "recovery" && (
          <RecoveryCodesStep
            codes={backupCodes}
            saved={saved}
            onSavedChange={setSaved}
            onFinish={finish}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
