"use client";

import { useEffect, useState } from "react";

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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authErrorMessage } from "@/lib/auth-errors";
import { isValidEmail } from "@/lib/auth-flow";
import { parseDrcPhone } from "@/lib/phone";
import { type StepUp, loadStepUp } from "@/lib/step-up";
import { type ContactKind, type UserProfile, usersApi } from "@/lib/users-api";

const COPY = {
  EMAIL: {
    addTitle: "Ajouter une adresse e-mail",
    changeTitle: "Changer d’adresse e-mail",
    label: "Nouvelle adresse e-mail",
    inputType: "email",
    placeholder: "vous@exemple.com",
    autoComplete: "email",
    where: "cette adresse",
  },
  PHONE: {
    addTitle: "Ajouter un numéro de téléphone",
    changeTitle: "Changer de numéro de téléphone",
    label: "Nouveau numéro (RDC)",
    inputType: "tel",
    placeholder: "0990 000 000",
    autoComplete: "tel",
    where: "ce numéro",
  },
} as const;

interface ContactChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: ContactKind;
  /** The current value, or null when the account has none yet. */
  current: string | null;
  onChanged: (profile: UserProfile) => void;
}

export function ContactChangeDialog(props: ContactChangeDialogProps) {
  return props.open ? <ContactFlow {...props} /> : null;
}

function ContactFlow({ open, onOpenChange, kind, current, onChanged }: ContactChangeDialogProps) {
  const copy = COPY[kind];
  const [stage, setStage] = useState<"request" | "verify">("request");
  const [value, setValue] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [stepUp, setStepUp] = useState<StepUp | null>(null);
  const [stepUpCode, setStepUpCode] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

  const phone = kind === "PHONE" ? parseDrcPhone(value) : null;
  const normalized = kind === "EMAIL" ? value.trim() : (phone?.e164 ?? "");
  const isContactValid = kind === "EMAIL" ? isValidEmail(value) : Boolean(phone?.valid);
  const canRequest = isContactValid && stepUpCode.length === OTP_CODE_LENGTH;

  async function handleRequest(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || !canRequest) return;
    setIsLoading(true);
    setError(null);
    try {
      const sent = await usersApi.requestContactChange({ kind, value: normalized, stepUpCode });
      setSentTo(sent.contact);
      setCode("");
      setStage("verify");
    } catch (err) {
      setError(authErrorMessage(err));
      setStepUpCode("");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || code.length !== OTP_CODE_LENGTH) return;
    setIsLoading(true);
    setError(null);
    try {
      onChanged(await usersApi.verifyContactChange({ kind, value: sentTo, code }));
      onOpenChange(false);
    } catch (err) {
      setError(authErrorMessage(err));
      setCode("");
    } finally {
      setIsLoading(false);
    }
  }

  function backToRequest() {
    setStage("request");
    setStepUpCode("");
    setCode("");
    setError(null);
    setStepUp(null);
    loadStepUp()
      .then(setStepUp)
      .catch((err) => setError(authErrorMessage(err)));
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isLoading && onOpenChange(next)}>
      <DialogContent className="gap-5 sm:max-w-md">
        {stage === "request" && (
          <form onSubmit={handleRequest} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>{current ? copy.changeTitle : copy.addTitle}</DialogTitle>
              <DialogDescription>
                Nous vous envoyons un code sur {copy.where} pour la confirmer. Votre contact actuel
                reste actif jusque-là.
              </DialogDescription>
            </DialogHeader>

            <Field>
              <FieldLabel htmlFor="new-contact">{copy.label}</FieldLabel>
              <Input
                id="new-contact"
                name="contact"
                type={copy.inputType}
                inputMode={kind === "PHONE" ? "tel" : "email"}
                autoComplete={copy.autoComplete}
                placeholder={copy.placeholder}
                value={value}
                onChange={(event) => {
                  setValue(event.target.value);
                  setError(null);
                }}
                disabled={isLoading}
                aria-invalid={value.length > 0 && !isContactValid}
                className="h-10"
                autoFocus
              />
              {kind === "PHONE" && value.length > 0 && !isContactValid && (
                <p className="text-xs text-muted-foreground">
                  Numéro invalide. Seuls les numéros de la RDC sont acceptés.
                </p>
              )}
            </Field>

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
                value={stepUpCode}
                onChange={(next) => {
                  setStepUpCode(next);
                  setError(null);
                }}
                disabled={isLoading || !stepUp}
                invalid={!!error}
                aria-label="Code de sécurité"
              />
              {error && <ErrorText>{error}</ErrorText>}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={isLoading}
              >
                Annuler
              </Button>
              <Button type="submit" disabled={isLoading || !canRequest}>
                {isLoading && <Spinner data-icon="inline-start" />}
                Envoyer le code
              </Button>
            </DialogFooter>
          </form>
        )}

        {stage === "verify" && (
          <form onSubmit={handleVerify} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>Confirmez {copy.where}</DialogTitle>
              <DialogDescription>
                Saisissez le code envoyé à{" "}
                <span className="font-medium text-foreground">{sentTo}</span>.
              </DialogDescription>
            </DialogHeader>

            <div className="flex flex-col items-center gap-3">
              <OtpCodeInput
                value={code}
                onChange={(next) => {
                  setCode(next);
                  setError(null);
                }}
                disabled={isLoading}
                invalid={!!error}
                autoFocus
                aria-label="Code de vérification"
              />
              {error && <ErrorText>{error}</ErrorText>}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={backToRequest} disabled={isLoading}>
                Retour
              </Button>
              <Button type="submit" disabled={isLoading || code.length !== OTP_CODE_LENGTH}>
                {isLoading && <Spinner data-icon="inline-start" />}
                Confirmer
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
