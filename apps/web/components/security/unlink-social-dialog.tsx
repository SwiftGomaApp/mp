"use client";

import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import type { SignInMethods } from "swiftgoma-mp-auth/account";

import { OTP_CODE_LENGTH, OtpCodeInput } from "@/components/auth/otp-code-input";
import { ErrorText } from "@/components/security/recovery-codes-step";
import type { SocialProviderName } from "@/components/security/link-social-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { account } from "@/lib/account";
import { authErrorMessage } from "@/lib/auth-errors";
import { loadStepUp, type StepUp } from "@/lib/step-up";

const PROVIDER_LABELS: Record<SocialProviderName, string> = {
  google: "Google",
  apple: "Apple",
};

interface UnlinkSocialDialogProps {
  provider: SocialProviderName | null;
  onOpenChange: (open: boolean) => void;
  /** Called with the sign-in methods the account has left. */
  onUnlinked: (methods: SignInMethods) => void;
}

export function UnlinkSocialDialog({
  provider,
  onOpenChange,
  onUnlinked,
}: UnlinkSocialDialogProps) {
  return provider ? (
    <UnlinkSocialFlow provider={provider} onOpenChange={onOpenChange} onUnlinked={onUnlinked} />
  ) : null;
}

function UnlinkSocialFlow({
  provider,
  onOpenChange,
  onUnlinked,
}: {
  provider: SocialProviderName;
  onOpenChange: (open: boolean) => void;
  onUnlinked: (methods: SignInMethods) => void;
}) {
  const [stepUp, setStepUp] = useState<StepUp | null>(null);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = PROVIDER_LABELS[provider];

  useEffect(() => {
    let cancelled = false;
    loadStepUp()
      .then((result) => {
        if (!cancelled) setStepUp(result);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleUnlink() {
    if (isLoading || code.length !== OTP_CODE_LENGTH) return;
    setIsLoading(true);
    setError(null);
    try {
      const methods = await account.methods.remove(provider === "google" ? "GOOGLE" : "APPLE", {
        code,
      });
      onOpenChange(false);
      onUnlinked(methods);
    } catch (err) {
      setError(authErrorMessage(err));
      setCode("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !isLoading && onOpenChange(open)}>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Délier le compte {label}</DialogTitle>
          <DialogDescription>
            Vous ne pourrez plus vous connecter avec {label}. Votre compte doit garder au moins une
            autre méthode de connexion.{" "}
            {stepUp?.authenticator
              ? "Saisissez le code de votre application d’authentification."
              : stepUp?.sentTo
                ? `Saisissez le code envoyé à ${stepUp.sentTo}.`
                : "Nous vous envoyons un code de vérification…"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
            <ShieldCheck className="size-5" />
          </span>
          <OtpCodeInput
            value={code}
            onChange={(value) => {
              setCode(value);
              setError(null);
            }}
            disabled={isLoading || !stepUp}
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
            variant="destructive"
            onClick={handleUnlink}
            disabled={isLoading || code.length !== OTP_CODE_LENGTH}
          >
            {isLoading && <Spinner data-icon="inline-start" />}
            Délier {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
