"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CircleCheck, ChevronLeft, Mail } from "lucide-react";

import { OTP_CODE_LENGTH, OtpCodeInput } from "@/components/auth/otp-code-input";
import { PasswordField } from "@/components/auth/password-field";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";
import { isValidEmail, RESEND_DELAY_SECONDS } from "@/lib/auth-flow";

const MIN_PASSWORD_LENGTH = 8;

type Step = "email" | "reset" | "done";

const BackToSignIn = () => (
  <Link
    href="/auth/sign-in"
    className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80 underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:underline"
  >
    <ChevronLeft className="size-3.5" />
    Retour à la connexion
  </Link>
);

export function ForgotPasswordView() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The resend countdown only exists while the code step is shown.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const trimmedEmail = email.trim();
  const passwordsMatch = newPassword === confirmPassword;
  const isResetValid =
    code.length === OTP_CODE_LENGTH && newPassword.length >= MIN_PASSWORD_LENGTH && passwordsMatch;

  async function run(task: () => Promise<void>) {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  const sendCode = () =>
    run(async () => {
      // The answer is the same whether or not the account exists.
      await auth.password.forgot({ email: trimmedEmail });
      setCode("");
      setSecondsLeft(RESEND_DELAY_SECONDS);
      setStep("reset");
    });

  const resetPassword = () =>
    run(async () => {
      await auth.password.reset({ email: trimmedEmail, code, newPassword });
      setNewPassword("");
      setConfirmPassword("");
      setStep("done");
    });

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {step === "email" && (
          <form
            className="flex w-full flex-col items-center gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (isValidEmail(trimmedEmail)) void sendCode();
            }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight">Mot de passe oublié ?</h1>
              <p className="text-xs text-muted-foreground">
                Saisissez l’adresse e-mail de votre compte. Nous vous enverrons un code pour choisir
                un nouveau mot de passe.
              </p>
            </div>

            <Field className="gap-1.5">
              <FieldLabel htmlFor="forgot-email" className="sr-only">
                Adresse e-mail
              </FieldLabel>
              <InputGroup className="h-10">
                <InputGroupAddon>
                  <Mail />
                </InputGroupAddon>
                <InputGroupInput
                  id="forgot-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="vous@exemple.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                  disabled={isLoading}
                  autoFocus
                  required
                />
              </InputGroup>
            </Field>

            {error && (
              <p role="alert" className="-mt-2 text-center text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="flex w-full flex-col items-center gap-4">
              <Button
                type="submit"
                variant={isValidEmail(trimmedEmail) ? "default" : "secondary"}
                size="lg"
                className="w-full"
                disabled={isLoading || !isValidEmail(trimmedEmail)}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                {isLoading ? "Envoi…" : "Envoyer le code"}
              </Button>
              <BackToSignIn />
            </div>
          </form>
        )}

        {step === "reset" && (
          <form
            className="flex w-full flex-col items-center gap-6"
            onSubmit={(event) => {
              event.preventDefault();
              if (isResetValid) void resetPassword();
            }}
          >
            <div className="flex flex-col items-center gap-2 text-center">
              <h1 className="text-2xl font-bold tracking-tight">Nouveau mot de passe</h1>
              <p className="text-xs text-muted-foreground">
                Si un compte existe pour{" "}
                <span className="font-medium text-foreground">{trimmedEmail}</span>, un code vient
                d’y être envoyé.
              </p>
            </div>

            <OtpCodeInput
              value={code}
              onChange={(value) => {
                setCode(value);
                setError(null);
              }}
              disabled={isLoading}
              invalid={!!error}
              autoFocus
              aria-label="Code de vérification"
            />

            <div className="grid w-full gap-3">
              <PasswordField
                id="forgot-new-password"
                label="Nouveau mot de passe"
                value={newPassword}
                onChange={(value) => {
                  setNewPassword(value);
                  setError(null);
                }}
                autoComplete="new-password"
                disabled={isLoading}
              />
              <PasswordField
                id="forgot-confirm-password"
                label="Confirmer le mot de passe"
                value={confirmPassword}
                onChange={(value) => {
                  setConfirmPassword(value);
                  setError(null);
                }}
                autoComplete="new-password"
                disabled={isLoading}
              />
              {newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH && (
                <p className="text-xs text-muted-foreground">
                  Au moins {MIN_PASSWORD_LENGTH} caractères.
                </p>
              )}
              {confirmPassword.length > 0 && !passwordsMatch && (
                <p role="alert" className="text-xs text-destructive">
                  Les mots de passe ne correspondent pas.
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="-mt-2 text-center text-xs text-destructive">
                {error}
              </p>
            )}

            <div className="flex w-full flex-col items-center gap-4">
              <Button
                type="submit"
                variant={isResetValid ? "default" : "secondary"}
                size="lg"
                className="w-full"
                disabled={isLoading || !isResetValid}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                {isLoading ? "Enregistrement…" : "Changer le mot de passe"}
              </Button>

              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={secondsLeft > 0 || isLoading}
                className="text-xs text-muted-foreground underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:underline disabled:pointer-events-none disabled:no-underline"
              >
                {secondsLeft > 0
                  ? `Renvoyer le code dans ${secondsLeft} s`
                  : "Renvoyer le code de vérification"}
              </button>

              <BackToSignIn />
            </div>
          </form>
        )}

        {step === "done" && (
          <div className="flex w-full flex-col items-center gap-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5 dark:text-emerald-400">
              <CircleCheck className="size-6" />
            </span>
            <div className="flex flex-col items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">Mot de passe modifié</h1>
              <p className="text-xs text-muted-foreground">
                Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.
              </p>
            </div>
            <Button
              size="lg"
              className="w-full"
              nativeButton={false}
              render={<Link href="/auth/sign-in" />}
            >
              Se connecter
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
