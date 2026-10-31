"use client";

import { useEffect, useState } from "react";
import { MailCheck } from "lucide-react";

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
import { Spinner } from "@/components/ui/spinner";
import { account } from "@/lib/account";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";

export type SocialProviderName = "google" | "apple";

const PROVIDER_LABELS: Record<SocialProviderName, string> = {
  google: "Google",
  apple: "Apple",
};

interface LinkSocialDialogProps {
  provider: SocialProviderName | null;
  onOpenChange: (open: boolean) => void;
  /** Called once the account is linked. */
  onLinked: () => void;
}

export function LinkSocialDialog({ provider, onOpenChange, onLinked }: LinkSocialDialogProps) {
  return provider ? (
    <LinkSocialFlow provider={provider} onOpenChange={onOpenChange} onLinked={onLinked} />
  ) : null;
}

function LinkSocialFlow({
  provider,
  onOpenChange,
  onLinked,
}: {
  provider: SocialProviderName;
  onOpenChange: (open: boolean) => void;
  onLinked: () => void;
}) {
  // With two-step verification on, the code to give is the one from the authenticator app.
  // `null` while the account is still being checked.
  const [usesAuthenticator, setUsesAuthenticator] = useState<boolean | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const label = PROVIDER_LABELS[provider];

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

  async function handleLink() {
    if (isLoading || code.length !== OTP_CODE_LENGTH) return;
    setIsLoading(true);
    setError(null);
    try {
      await account.link[provider]({ stepUpCode: code });
      onOpenChange(false);
      onLinked();
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
          <DialogTitle>Lier un compte {label}</DialogTitle>
          <DialogDescription>
            {usesAuthenticator
              ? "Saisissez le code de votre application d’authentification, puis choisissez le compte à lier."
              : sentTo
                ? `Saisissez le code envoyé à ${sentTo}, puis choisissez le compte à lier.`
                : "Nous vous envoyons un code de vérification…"}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
            <MailCheck className="size-5" />
          </span>
          <OtpCodeInput
            value={code}
            onChange={(value) => {
              setCode(value);
              setError(null);
            }}
            disabled={isLoading || (usesAuthenticator !== true && !sentTo)}
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
          <Button onClick={handleLink} disabled={isLoading || code.length !== OTP_CODE_LENGTH}>
            {isLoading && <Spinner data-icon="inline-start" />}
            Lier avec {label}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
