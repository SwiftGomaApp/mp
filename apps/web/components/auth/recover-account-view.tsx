"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ChevronLeft, CircleCheck, Clock } from "lucide-react";
import { hasErrorCode } from "swiftgoma-mp-auth";

import { ContactField, useContactField } from "@/components/auth/contact-field";
import { OTP_CODE_LENGTH, OtpCodeInput } from "@/components/auth/otp-code-input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { account } from "@/lib/account";
import { authErrorMessage } from "@/lib/auth-errors";
import { RESEND_DELAY_SECONDS } from "@/lib/auth-flow";
import {
  clearRecovery,
  parseRecovery,
  readRecoverySnapshot,
  saveRecovery,
  subscribeRecovery,
  type StoredRecovery,
} from "@/lib/recovery";

type LocalStep = "identify" | "verify" | "done";

const getServerSnapshot = () => null;

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeStyle: "short" }).format(new Date(iso));

const SignInLink = ({ label = "Retour à la connexion" }: { label?: string }) => (
  <Link
    href="/auth/sign-in"
    className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80 underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:underline"
  >
    <ChevronLeft className="size-3.5" />
    {label}
  </Link>
);

function Heading({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
      {children && <p className="text-xs text-muted-foreground">{children}</p>}
    </div>
  );
}

function ErrorLine({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="text-center text-xs text-destructive">
      {children}
    </p>
  );
}

export function RecoverAccountView() {
  const identify = useContactField();
  const newContact = useContactField();
  const stored = parseRecovery(
    useSyncExternalStore(subscribeRecovery, readRecoverySnapshot, getServerSnapshot),
  );
  // Kept in memory too, for browsers that cannot store it.
  const [memory, setMemory] = useState<StoredRecovery | null>(null);
  const recovery = stored ?? memory;

  const [step, setStep] = useState<LocalStep>("identify");
  const [code, setCode] = useState("");
  const [newContactCode, setNewContactCode] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [backupCode, setBackupCode] = useState("");
  const [needsBackupCode, setNeedsBackupCode] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);
  // Unknown until the browser has read the clock, so nothing time-based is rendered on the server.
  const [now, setNow] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The resend countdown of the first code.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // Lets the waiting screen turn into the next step by itself when the delay ends.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, []);

  const waiting = recovery && now !== null ? new Date(recovery.availableAt).getTime() > now : false;
  const clockReady = !recovery || now !== null;
  const target =
    identify.method === "email" ? { email: identify.contact } : { phone: identify.contact };

  function forgetRecovery() {
    clearRecovery();
    setMemory(null);
    setCodeSent(false);
    setNeedsBackupCode(false);
    setStep("identify");
  }

  async function run(task: () => Promise<void>) {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      await task();
    } catch (err) {
      if (hasErrorCode(err, "RECOVERY_INVALID")) forgetRecovery();
      if (hasErrorCode(err, "RECOVERY_BACKUP_CODE_REQUIRED")) setNeedsBackupCode(true);
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  const requestCode = () =>
    run(async () => {
      // The answer is the same whether or not the account has a recovery contact.
      await account.recovery.request(target);
      setCode("");
      setSecondsLeft(RESEND_DELAY_SECONDS);
      setStep("verify");
    });

  const verifyCode = () =>
    run(async () => {
      const result = await account.recovery.verify({ ...target, code });
      const next = { token: result.recoveryToken, availableAt: result.availableAt };
      setMemory(next);
      saveRecovery(next);
      setNow(Date.now());
    });

  const sendNewContactCode = () =>
    run(async () => {
      if (!recovery) return;
      await account.recovery.setNewContact({
        token: recovery.token,
        kind: newContact.method === "email" ? "EMAIL" : "PHONE",
        value: newContact.contact,
      });
      setNewContactCode("");
      setCodeSent(true);
    });

  const completeRecovery = () =>
    run(async () => {
      if (!recovery) return;
      await account.recovery.complete({
        token: recovery.token,
        kind: newContact.method === "email" ? "EMAIL" : "PHONE",
        value: newContact.contact,
        code: newContactCode,
        ...(backupCode.trim() && { backupCode: backupCode.trim() }),
      });
      forgetRecovery();
      setStep("done");
    });

  const submit = (event: React.FormEvent, action: () => Promise<void>, ready: boolean) => {
    event.preventDefault();
    if (ready) void action();
  };

  const canCompleteWithBackup = !needsBackupCode || backupCode.trim().length > 0;

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        {/* 1. Which account */}
        {!recovery && step === "identify" && (
          <form
            className="flex w-full flex-col items-center gap-6"
            onSubmit={(event) => submit(event, requestCode, identify.isValid)}
          >
            <Heading title="Récupérer votre compte">
              Vous n’avez plus accès à votre e-mail ni à votre téléphone ? Indiquez l’adresse ou le
              numéro de votre compte. Nous enverrons un code à votre contact de récupération.
            </Heading>

            <div className="grid w-full gap-3">
              <ContactField
                state={identify}
                disabled={isLoading}
                switcher="tabs"
                showSeparator={false}
              />
            </div>

            {error && <ErrorLine>{error}</ErrorLine>}

            <div className="flex w-full flex-col items-center gap-4">
              <Button
                type="submit"
                variant={identify.isValid ? "default" : "secondary"}
                size="lg"
                className="w-full"
                disabled={isLoading || !identify.isValid}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                {isLoading ? "Envoi…" : "Envoyer le code"}
              </Button>
              <SignInLink />
            </div>
          </form>
        )}

        {/* 2. Code sent to the recovery contact */}
        {!recovery && step === "verify" && (
          <form
            className="flex w-full flex-col items-center gap-6"
            onSubmit={(event) => submit(event, verifyCode, code.length === OTP_CODE_LENGTH)}
          >
            <Heading title="Saisissez le code">
              Si ce compte a un contact de récupération vérifié, un code vient de lui être envoyé.
            </Heading>

            <OtpCodeInput
              value={code}
              onChange={(value) => {
                setCode(value);
                setError(null);
              }}
              disabled={isLoading}
              invalid={!!error}
              autoFocus
              aria-label="Code de récupération"
            />

            {error && <ErrorLine>{error}</ErrorLine>}

            <div className="flex w-full flex-col items-center gap-4">
              <Button
                type="submit"
                variant={code.length === OTP_CODE_LENGTH ? "default" : "secondary"}
                size="lg"
                className="w-full"
                disabled={isLoading || code.length !== OTP_CODE_LENGTH}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                {isLoading ? "Vérification…" : "Continuer"}
              </Button>
              <button
                type="button"
                onClick={() => void requestCode()}
                disabled={secondsLeft > 0 || isLoading}
                className="text-xs text-muted-foreground underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:underline disabled:pointer-events-none disabled:no-underline"
              >
                {secondsLeft > 0 ? `Renvoyer le code dans ${secondsLeft} s` : "Renvoyer le code"}
              </button>
              <SignInLink />
            </div>
          </form>
        )}

        {/* 3. Security delay */}
        {recovery && waiting && (
          <div className="flex w-full flex-col items-center gap-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
              <Clock className="size-6" />
            </span>
            <Heading title="Délai de sécurité">
              Pour protéger votre compte, vous pourrez choisir votre nouveau contact à partir du{" "}
              <span className="font-medium text-foreground">
                {formatDate(recovery.availableAt)}
              </span>
              . Nous avons prévenu vos contacts actuels : ils peuvent annuler cette demande si elle
              ne vient pas de vous.
            </Heading>
            <p className="text-xs text-muted-foreground">
              Vous pouvez fermer cette page et revenir plus tard : votre demande est conservée sur
              cet appareil.
            </p>
            <div className="flex w-full flex-col items-center gap-4">
              <button
                type="button"
                onClick={forgetRecovery}
                className="text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
              >
                Recommencer depuis le début
              </button>
              <SignInLink />
            </div>
          </div>
        )}

        {/* 4. New primary contact */}
        {recovery && clockReady && !waiting && !codeSent && (
          <form
            className="flex w-full flex-col items-center gap-6"
            onSubmit={(event) => submit(event, sendNewContactCode, newContact.isValid)}
          >
            <Heading title="Votre nouveau contact">
              Choisissez l’adresse e-mail ou le numéro qui remplacera l’ancien. Il deviendra votre
              contact principal pour vous connecter.
            </Heading>

            <div className="grid w-full gap-3">
              <ContactField
                state={newContact}
                disabled={isLoading}
                switcher="tabs"
                showSeparator={false}
              />
            </div>

            {error && <ErrorLine>{error}</ErrorLine>}

            <div className="flex w-full flex-col items-center gap-4">
              <Button
                type="submit"
                variant={newContact.isValid ? "default" : "secondary"}
                size="lg"
                className="w-full"
                disabled={isLoading || !newContact.isValid}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                {isLoading ? "Envoi…" : "Envoyer le code"}
              </Button>
              <button
                type="button"
                onClick={forgetRecovery}
                className="text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
              >
                Recommencer depuis le début
              </button>
            </div>
          </form>
        )}

        {/* 5. Confirm the new contact */}
        {recovery && clockReady && !waiting && codeSent && (
          <form
            className="flex w-full flex-col items-center gap-6"
            onSubmit={(event) =>
              submit(
                event,
                completeRecovery,
                newContactCode.length === OTP_CODE_LENGTH && canCompleteWithBackup,
              )
            }
          >
            <Heading title="Confirmez votre contact">
              Saisissez le code envoyé à{" "}
              <span className="font-medium text-foreground">{newContact.contact}</span>.
            </Heading>

            <OtpCodeInput
              value={newContactCode}
              onChange={(value) => {
                setNewContactCode(value);
                setError(null);
              }}
              disabled={isLoading}
              invalid={!!error}
              autoFocus
              aria-label="Code envoyé à votre nouveau contact"
            />

            {needsBackupCode && (
              <Field className="gap-1.5">
                <FieldLabel htmlFor="recovery-backup-code" className="text-xs">
                  Code de récupération de la double vérification
                </FieldLabel>
                <Input
                  id="recovery-backup-code"
                  value={backupCode}
                  onChange={(event) => {
                    setBackupCode(event.target.value);
                    setError(null);
                  }}
                  placeholder="xxxxxxxx-xxxxxxxx"
                  autoComplete="off"
                  disabled={isLoading}
                  className="h-10 text-center font-mono"
                />
              </Field>
            )}

            {error && <ErrorLine>{error}</ErrorLine>}

            <div className="flex w-full flex-col items-center gap-4">
              <Button
                type="submit"
                variant={newContactCode.length === OTP_CODE_LENGTH ? "default" : "secondary"}
                size="lg"
                className="w-full"
                disabled={
                  isLoading || newContactCode.length !== OTP_CODE_LENGTH || !canCompleteWithBackup
                }
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                {isLoading ? "Vérification…" : "Récupérer mon compte"}
              </Button>
              <button
                type="button"
                onClick={() => {
                  setCodeSent(false);
                  setError(null);
                }}
                disabled={isLoading}
                className="text-xs text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:underline"
              >
                Changer de contact
              </button>
            </div>
          </form>
        )}

        {/* 6. Done */}
        {!recovery && step === "done" && (
          <div className="flex w-full flex-col items-center gap-6 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5 dark:text-emerald-400">
              <CircleCheck className="size-6" />
            </span>
            <Heading title="Compte récupéré">
              Connectez-vous avec votre nouveau contact. Pensez à ajouter un mot de passe et un
              contact de récupération dans la section Sécurité.
            </Heading>
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
