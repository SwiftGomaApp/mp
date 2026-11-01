"use client";

import { useEffect, useState } from "react";
import { Fingerprint, ShieldCheck } from "lucide-react";

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
import { Spinner } from "@/components/ui/spinner";
import { account } from "@/lib/account";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";

const MAX_NAME_LENGTH = 60;

interface PasskeySetupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PasskeySetupDialog(props: PasskeySetupDialogProps) {
  return props.open ? <PasskeySetupFlow {...props} /> : null;
}

function PasskeyIllustration() {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-40 items-center justify-center overflow-hidden rounded-xl border bg-muted/30"
    >
      <span className="absolute inset-x-0 top-1/2 h-px bg-border" />
      <span className="absolute inset-y-0 left-1/2 w-px bg-border" />
      <span className="absolute top-6 left-[62%] size-2 rounded-full border bg-background" />
      <span className="absolute bottom-6 left-[44%] size-2 rounded-full border bg-background" />
      <span className="absolute top-[58%] left-[26%] size-2 rounded-full border bg-background" />
      <span className="relative flex size-16 items-center justify-center rounded-2xl border bg-background shadow-sm ring-8 ring-primary/5">
        <Fingerprint className="size-7 text-foreground/80" />
      </span>
    </div>
  );
}

function PasskeySetupFlow({ open, onOpenChange }: PasskeySetupDialogProps) {
  const [step, setStep] = useState<"create" | "name">("create");
  const [usesAuthenticator, setUsesAuthenticator] = useState<boolean | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [stepUpCode, setStepUpCode] = useState("");
  const [passkeyId, setPasskeyId] = useState<string | null>(null);
  const [defaultName, setDefaultName] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    account.twoFactor
      .status()
      .then(async ({ enabled }) => {
        if (cancelled) return;
        setUsesAuthenticator(enabled);
        if (enabled) return;
        const sent = await auth.stepUp.request();
        if (!cancelled) setSentTo(sent.target);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const codeReady = usesAuthenticator === true || sentTo !== null;

  async function handleCreate() {
    if (isLoading || stepUpCode.length !== OTP_CODE_LENGTH) return;
    setIsLoading(true);
    setError(null);
    try {
      const passkey = await account.passkeys.register({ stepUpCode });
      setPasskeyId(passkey.id);
      setDefaultName(passkey.name);
      setName(passkey.name);
      setStep("name");
    } catch (err) {
      setError(authErrorMessage(err));
      setStepUpCode("");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSave() {
    const trimmed = name.trim();
    if (!passkeyId || !trimmed || trimmed === defaultName) return onOpenChange(false);
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await account.passkeys.rename(passkeyId, trimmed);
      onOpenChange(false);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isLoading && onOpenChange(next)}>
      <DialogContent className="gap-5 sm:max-w-md">
        {step === "create" && (
          <>
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-lg">Créer une clé d’accès</DialogTitle>
              <DialogDescription>
                Une clé d’accès est un moyen simple et sûr de vous connecter avec la biométrie, une
                clé de sécurité ou un code PIN.
              </DialogDescription>
            </DialogHeader>

            <PasskeyIllustration />

            <div className="flex flex-col items-center gap-3">
              <p className="flex items-center gap-1.5 text-center text-xs text-muted-foreground">
                <ShieldCheck className="size-3.5 shrink-0" />
                {usesAuthenticator
                  ? "Saisissez le code de votre application d’authentification."
                  : sentTo
                    ? `Saisissez le code envoyé à ${sentTo}.`
                    : "Nous vous envoyons un code de vérification…"}
              </p>
              <OtpCodeInput
                value={stepUpCode}
                onChange={(value) => {
                  setStepUpCode(value);
                  setError(null);
                }}
                disabled={isLoading || !codeReady}
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
                onClick={handleCreate}
                disabled={isLoading || stepUpCode.length !== OTP_CODE_LENGTH}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                Continuer
              </Button>
            </DialogFooter>
          </>
        )}

        {step === "name" && (
          <>
            <DialogHeader className="items-center text-center">
              <DialogTitle className="text-lg">Clé d’accès créée</DialogTitle>
              <DialogDescription>
                Vous pouvez donner un nom personnalisé à cet appareil, ou garder celui proposé.
              </DialogDescription>
            </DialogHeader>

            <form
              id="passkey-name-form"
              className="grid gap-2 py-4"
              onSubmit={(event) => {
                event.preventDefault();
                void handleSave();
              }}
            >
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={MAX_NAME_LENGTH}
                autoFocus
                disabled={isLoading}
                aria-label="Nom de la clé d’accès"
                className="h-10 text-center"
              />
              {error && <ErrorText>{error}</ErrorText>}
            </form>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
                Fermer
              </Button>
              <Button type="submit" form="passkey-name-form" disabled={isLoading || !name.trim()}>
                {isLoading && <Spinner data-icon="inline-start" />}
                Enregistrer
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
