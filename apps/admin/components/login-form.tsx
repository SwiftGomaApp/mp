"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { PasswordLoginDialog } from "@/components/auth/password-login-dialog";
import { SocialButtons } from "@/components/auth/social-buttons";
import { ContactField, useContactField } from "@/components/auth/contact-field";
import { REFUSED_MESSAGE, useStaffSignIn } from "@/components/auth/use-staff-sign-in";
import { Button } from "@/components/ui/button";
import { Field, FieldGroup } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { auth } from "@/lib/auth";
import { requestSignInCode, signInWithGoogle, signInWithPasskey } from "@/lib/auth-actions";
import { authErrorMessage } from "@/lib/auth-errors";
import { saveVerificationTarget } from "@/lib/auth-flow";
import { isStaffRole } from "@/lib/roles";
import type { LoginResult } from "swiftgoma-mp-auth";

export function LoginForm() {
  const router = useRouter();
  const signIn = useStaffSignIn();
  const contact = useContactField();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A leftover non-staff session must not stay signed in.
  useEffect(() => {
    const user = auth.session.getState().user;
    if (user && !isStaffRole(user.role)) void auth.logout().catch(() => undefined);
  }, []);

  async function runProvider(action: () => Promise<LoginResult>) {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await signIn.handle(await action());
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
      router.push(`/verify${window.location.search}`);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  const message = signIn.refused ? REFUSED_MESSAGE : error;

  return (
    <AuthSplitLayout
      topRight={<PasswordLoginDialog onResult={signIn.handle} />}
      footer={
        <p className="text-center text-xs text-muted-foreground">
          Réservé au Support et aux Administrateurs SwiftGoma.
        </p>
      }
    >
      <form className="w-full max-w-sm" onSubmit={handleSubmit}>
        <FieldGroup className="items-center">
          <div className="flex flex-col items-center gap-3 text-center">
            <Image src="/logo-icon.png" alt="SwiftGoma" width={48} height={48} priority />
            <h1 className="text-2xl font-bold tracking-tight">Console SwiftGoma</h1>
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

          {message && (
            <p role="alert" className="text-center text-xs text-destructive">
              {message}
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
            <p className="text-center text-xs text-muted-foreground">
              Mot de passe oublié ?{" "}
              <Link href="/forgot" className="font-medium text-foreground underline underline-offset-4">
                Le réinitialiser
              </Link>
            </p>
          </Field>
        </FieldGroup>
      </form>
      {signIn.dialogs}
    </AuthSplitLayout>
  );
}
