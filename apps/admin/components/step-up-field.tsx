"use client";

import { useState } from "react";

import { Button, ErrorBanner, Field, Input, Notice } from "@/components/ui";
import { auth } from "@/lib/auth";

/**
 * The acting admin's own confirmation code, required by destructive actions. Staff accounts have
 * two-step verification, so the code is the one from the authenticator app; the button asks the
 * server to send a code by e-mail/SMS instead (`POST /auth/step-up/otp`).
 */
export function StepUpField({ value, onChange }: { value: string; onChange: (code: string) => void }) {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState(false);

  async function request() {
    setBusy(true);
    setError(null);
    try {
      const result = await auth.stepUp.request();
      setSent(`Code envoyé à ${result.target} (valable ${result.expiresMinutes} min).`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <Field
        label="Votre code de confirmation"
        hint="Code à 6 chiffres de votre application d'authentification, ou code reçu par message."
      >
        <Input
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          pattern="\d{6}"
          value={value}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, ""))}
        />
      </Field>
      <div>
        <Button variant="outline" size="sm" loading={busy} onClick={request}>
          Recevoir un code par message
        </Button>
      </div>
      {sent && <Notice tone="good">{sent}</Notice>}
      <ErrorBanner error={error} />
    </div>
  );
}
