"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { ContactField, useContactField } from "@/components/auth/contact-field";
import { LegalNotice } from "@/components/auth/legal-links";
import { PasswordLoginDialog } from "@/components/auth/password-login-dialog";
import { SocialButtons } from "@/components/auth/social-buttons";
import { TwoFactorDialog } from "@/components/auth/two-factor-dialog";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { saveVerificationTarget, POST_LOGIN_PATH } from "@/lib/auth-flow";
import {
  type SignInOutcome,
  requestSignInCode,
  signInWithGoogle,
  signInWithPasskey,
} from "@/lib/auth-actions";
import { authErrorMessage } from "@/lib/auth-errors";

export function SignInView() {
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const contact = useContactField();
  const [isLoading, setIsLoading] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);

  async function runProvider(action: () => Promise<SignInOutcome>) {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const outcome = await action();
      if (outcome === "authenticated") router.push(POST_LOGIN_PATH);
      else if (outcome === "twoFactor") setTwoFactorOpen(true);
      else {
        setError(
          "Votre compte doit activer la double vérification avant de continuer. Cette étape arrive bientôt.",
        );
      }
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || !contact.isValid) return;
    setIsLoading(true);
    setError(null);
    try {
      const target = { method: contact.method, value: contact.contact };
      await requestSignInCode(target);
      saveVerificationTarget({ flow: "sign-in", ...target });
      router.push("/auth/verify");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <AuthSplitLayout topRight={<PasswordLoginDialog />}>
      <form className="w-full max-w-sm" onSubmit={handleSubmit}>
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

          <SocialButtons
            verb="Continuer"
            disabled={isLoading}
            withPasskey
            onGoogle={() => runProvider(signInWithGoogle)}
            onPasskey={() => runProvider(signInWithPasskey)}
          />

          <ContactField state={contact} disabled={isLoading} webauthn />

          {error && (
            <p role="alert" className="text-center text-xs text-destructive">
              {error}
            </p>
          )}

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

          <LegalNotice />
        </FieldGroup>
      </form>

      <TwoFactorDialog
        open={twoFactorOpen}
        onOpenChange={setTwoFactorOpen}
        onVerified={() => router.push(POST_LOGIN_PATH)}
      />
    </AuthSplitLayout>
  );
}
