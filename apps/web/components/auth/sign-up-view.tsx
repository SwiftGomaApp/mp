"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { ContactField, useContactField } from "@/components/auth/contact-field";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { saveVerificationTarget } from "@/lib/auth-flow";

const MIN_NAME_LENGTH = 2;

export function SignUpView() {
  const router = useRouter();
  const contact = useContactField();
  const [fullName, setFullName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const trimmedName = fullName.trim().replace(/\s+/g, " ");
  const isValid = trimmedName.length >= MIN_NAME_LENGTH && contact.isValid;

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <form
        className="w-full max-w-sm"
        onSubmit={async (event) => {
          event.preventDefault();
          if (isLoading || !isValid) return;
          setIsLoading(true);
          try {
            // TODO: replace with the real sign-up call from the auth package (sends the verification code).
            await new Promise((resolve) => setTimeout(resolve, 1500));
            saveVerificationTarget({
              flow: "sign-up",
              method: contact.method,
              value: contact.contact,
              fullName: trimmedName,
            });
            router.push("/auth/sign-up/verify");
          } catch {
            setIsLoading(false);
          }
        }}
      >
        <FieldGroup className="items-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image src="/logo-icon.png" alt="SwiftGoma" width={48} height={48} priority />
            <h1 className="text-2xl font-bold tracking-tight">Créez votre compte</h1>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Rejoignez SwiftGoma pour
              <br />
              acheter, vendre ou livrer
            </p>
          </div>

          <SocialButtons verb="S’inscrire" disabled={isLoading} />

          <ContactField state={contact} disabled={isLoading} switcher="tabs" />

          <Field>
            <FieldLabel htmlFor="full-name" className="sr-only">
              Nom complet
            </FieldLabel>
            <Input
              id="full-name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Nom complet"
              value={fullName}
              onChange={(event) => setFullName(event.target.value)}
              disabled={isLoading}
              className="h-10"
              required
            />
          </Field>

          <Field>
            <Button
              type="submit"
              variant={isValid ? "default" : "secondary"}
              size="lg"
              className="w-full"
              disabled={isLoading || !isValid}
            >
              {isLoading && <Spinner data-icon="inline-start" />}
              {isLoading ? "Chargement…" : "Continuer"}
            </Button>
            <FieldDescription className="text-center">
              Vous avez déjà un compte ? <Link href="/auth/sign-in">Connectez-vous</Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </div>
  );
}
