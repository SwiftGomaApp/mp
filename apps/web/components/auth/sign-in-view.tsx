"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ContactField, useContactField } from "@/components/auth/contact-field";
import { PasswordLoginDialog } from "@/components/auth/password-login-dialog";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { saveVerificationTarget } from "@/lib/auth-flow";

export function SignInView() {
  const router = useRouter();
  const contact = useContactField();
  const [isLoading, setIsLoading] = useState(false);

  return (
    <AuthSplitLayout topRight={<PasswordLoginDialog />}>
      <form
        className="w-full max-w-sm"
        onSubmit={async (event) => {
          event.preventDefault();
          if (isLoading || !contact.isValid) return;
          setIsLoading(true);
          try {
            // TODO: replace with the real "send me a code" call from the auth package.
            await new Promise((resolve) => setTimeout(resolve, 1500));
            saveVerificationTarget({
              flow: "sign-in",
              method: contact.method,
              value: contact.contact,
            });
            router.push("/auth/verify");
          } catch {
            setIsLoading(false);
          }
        }}
      >
        <FieldGroup className="items-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image src="/logo-icon.png" alt="SwiftGoma" width={48} height={48} priority />
            <h1 className="text-2xl font-bold tracking-tight">Bienvenue sur SwiftGoma</h1>
            <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Choisissez une option pour vous
              <br />
              connecter à votre compte
            </p>
          </div>

          <SocialButtons verb="Continuer" disabled={isLoading} withPasskey />

          <ContactField state={contact} disabled={isLoading} webauthn />

          <Field>
            <Button
              type="submit"
              variant={contact.isValid ? "default" : "secondary"}
              size="lg"
              className="w-full"
              disabled={isLoading || !contact.isValid}
            >
              {isLoading && <Spinner data-icon="inline-start" />}
              {isLoading ? "Chargement…" : "Continuer"}
            </Button>
            <FieldDescription className="text-center">
              Vous n&apos;avez pas de compte ? <Link href="/auth/sign-up">Inscrivez-vous</Link>
            </FieldDescription>
          </Field>
        </FieldGroup>
      </form>
    </AuthSplitLayout>
  );
}
