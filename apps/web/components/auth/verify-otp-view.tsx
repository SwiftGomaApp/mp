"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { OTP_CODE_LENGTH, OtpCodeInput } from "@/components/auth/otp-code-input";
import { TwoFactorDialog } from "@/components/auth/two-factor-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  type AuthFlow,
  type VerificationMethod,
  clearVerificationTarget,
  devRequiresTwoFactor,
  maskVerificationTarget,
  parseVerificationTarget,
  readStoredVerificationTarget,
  readVerificationTarget,
} from "@/lib/auth-flow";

const RESEND_DELAY_SECONDS = 60;

const subscribe = () => () => {};
const getServerTarget = () => null;

const FLOW_COPY = {
  "sign-in": {
    startPath: "/auth/sign-in",
    backLabel: "Retour à la connexion",
    title: () => "Vérifiez votre connexion",
  },
  "sign-up": {
    startPath: "/auth/sign-up",
    backLabel: "Retour à l’inscription",
    title: (method: VerificationMethod) =>
      method === "email" ? "Vérifiez votre e-mail" : "Vérifiez votre numéro",
  },
} as const;

export function VerifyOtpView({ flow }: { flow: AuthFlow }) {
  const copy = FLOW_COPY[flow];
  const router = useRouter();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_DELAY_SECONDS);

  const target = parseVerificationTarget(
    useSyncExternalStore(subscribe, readStoredVerificationTarget, getServerTarget),
  );
  const isComplete = code.length === OTP_CODE_LENGTH;

  useEffect(() => {
    if (readVerificationTarget()?.flow !== flow) router.replace(copy.startPath);
  }, [router, flow, copy.startPath]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((current) => current - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function finish() {
    clearVerificationTarget();
    router.push("/");
  }

  async function handleVerify(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || !isComplete) return;
    setIsLoading(true);
    try {
      // TODO: replace with the real code verification call from the auth package.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      if (flow === "sign-in" && target && devRequiresTwoFactor(target.value)) {
        setIsLoading(false);
        setTwoFactorOpen(true);
        return;
      }
      finish();
    } catch {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (secondsLeft > 0 || isResending) return;
    setIsResending(true);
    try {
      // TODO: replace with the real "send a new code" call from the auth package.
      await new Promise((resolve) => setTimeout(resolve, 800));
      setCode("");
      setSecondsLeft(RESEND_DELAY_SECONDS);
    } finally {
      setIsResending(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <form onSubmit={handleVerify} className="flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {copy.title(target?.method ?? "email")}
          </h1>
          <p className="min-h-4 text-xs text-muted-foreground">
            {target ? (
              <>
                Saisissez le code envoyé à{" "}
                <span className="font-medium text-foreground">
                  {maskVerificationTarget(target)}
                </span>
              </>
            ) : (
              " "
            )}
          </p>
        </div>

        <OtpCodeInput
          value={code}
          onChange={setCode}
          disabled={isLoading}
          autoFocus
          aria-label="Code de vérification"
        />

        <div className="flex w-full flex-col items-center gap-4">
          <Button
            type="submit"
            variant={isComplete ? "default" : "secondary"}
            size="lg"
            className="w-full"
            disabled={isLoading || !isComplete}
          >
            {isLoading && <Spinner data-icon="inline-start" />}
            {isLoading ? "Vérification…" : "Continuer"}
          </Button>

          <button
            type="button"
            onClick={handleResend}
            disabled={secondsLeft > 0 || isResending || isLoading}
            className="text-xs text-muted-foreground underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:underline disabled:pointer-events-none disabled:no-underline"
          >
            {secondsLeft > 0
              ? `Renvoyer le code dans ${secondsLeft} s`
              : isResending
                ? "Envoi en cours…"
                : "Renvoyer le code de vérification"}
          </button>

          <Link
            href={copy.startPath}
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground/80 underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:underline"
          >
            <ChevronLeft className="size-3.5" />
            {copy.backLabel}
          </Link>
        </div>
      </form>

      <TwoFactorDialog open={twoFactorOpen} onOpenChange={setTwoFactorOpen} onVerified={finish} />
    </div>
  );
}
