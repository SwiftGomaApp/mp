"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, CircleCheck } from "lucide-react";

import { ContactField, useContactField } from "@/components/auth/contact-field";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { account } from "@/lib/account";
import { authErrorMessage } from "@/lib/auth-errors";

const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 1000;

const SignInLink = () => (
  <Link
    href="/auth/sign-in"
    className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80 underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:underline"
  >
    <ChevronLeft className="size-3.5" />
    Retour à la connexion
  </Link>
);

/** A suspended or banned account cannot sign in: this is how its owner reaches the Support. */
export function ContactSupportView() {
  const contact = useContactField();
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmed = message.trim();
  const isValid = contact.isValid && trimmed.length >= MIN_MESSAGE_LENGTH;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || !isValid) return;
    setIsLoading(true);
    setError(null);
    try {
      // The answer is the same whatever the state of the account.
      await account.supportRequest({
        ...(contact.method === "email" ? { email: contact.contact } : { phone: contact.contact }),
        message: trimmed,
      });
      setSent(true);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="flex min-h-svh items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col items-center gap-6 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5 dark:text-emerald-400">
            <CircleCheck className="size-6" />
          </span>
          <div className="flex flex-col items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Message envoyé</h1>
            <p className="text-xs text-muted-foreground">
              Si ce compte est suspendu, votre message a été transmis au Support. Vous serez
              contacté.
            </p>
          </div>
          <SignInLink />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <form onSubmit={handleSubmit} className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Contacter le Support</h1>
          <p className="text-xs text-muted-foreground">
            Votre compte est suspendu ? Indiquez l’adresse ou le numéro de votre compte et expliquez
            votre situation.
          </p>
        </div>

        <div className="grid w-full gap-3">
          <ContactField
            state={contact}
            disabled={isLoading}
            switcher="tabs"
            showSeparator={false}
          />

          <Field className="gap-1.5">
            <FieldLabel htmlFor="support-message" className="sr-only">
              Votre message
            </FieldLabel>
            <Textarea
              id="support-message"
              value={message}
              onChange={(event) => {
                setMessage(event.target.value);
                setError(null);
              }}
              maxLength={MAX_MESSAGE_LENGTH}
              rows={5}
              placeholder="Expliquez votre situation"
              disabled={isLoading}
              required
            />
            <p className="text-right text-xs text-muted-foreground">
              {trimmed.length}/{MAX_MESSAGE_LENGTH}
            </p>
          </Field>
        </div>

        {error && (
          <p role="alert" className="-mt-2 text-center text-xs text-destructive">
            {error}
          </p>
        )}

        <div className="flex w-full flex-col items-center gap-4">
          <Button
            type="submit"
            variant={isValid ? "default" : "secondary"}
            size="lg"
            className="w-full"
            disabled={isLoading || !isValid}
          >
            {isLoading && <Spinner data-icon="inline-start" />}
            {isLoading ? "Envoi…" : "Envoyer au Support"}
          </Button>
          <SignInLink />
        </div>
      </form>
    </div>
  );
}
