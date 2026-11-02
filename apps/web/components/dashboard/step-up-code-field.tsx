"use client";

import { useEffect, useState } from "react";

import { OtpCodeInput } from "@/components/auth/otp-code-input";
import { ErrorText } from "@/components/security/recovery-codes-step";
import { authErrorMessage } from "@/lib/auth-errors";
import { type StepUp, loadStepUp } from "@/lib/step-up";

interface StepUpCodeFieldProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error: string | null;
  onError: (message: string | null) => void;
}

/** Asks for the security code (authenticator or code sent to the account contact). */
export function StepUpCodeField({
  value,
  onChange,
  disabled,
  error,
  onError,
}: StepUpCodeFieldProps) {
  const [stepUp, setStepUp] = useState<StepUp | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadStepUp()
      .then((result) => {
        if (!cancelled) setStepUp(result);
      })
      .catch((err) => {
        if (!cancelled) onError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, [onError]);

  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-center text-xs text-muted-foreground">
        {stepUp?.authenticator
          ? "Pour votre sécurité, saisissez le code de votre application d’authentification"
          : stepUp?.sentTo
            ? `Pour votre sécurité, saisissez le code envoyé à ${stepUp.sentTo}`
            : stepUp?.alreadySent
              ? "Un code de sécurité vous a déjà été envoyé. Saisissez-le ci-dessous."
              : "Nous vous envoyons un code de sécurité…"}
      </p>
      <OtpCodeInput
        value={value}
        onChange={(next) => {
          onChange(next);
          onError(null);
        }}
        disabled={disabled || !stepUp}
        invalid={!!error}
        aria-label="Code de sécurité"
      />
      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
