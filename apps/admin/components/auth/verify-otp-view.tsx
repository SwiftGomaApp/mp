"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

import { OTP_CODE_LENGTH, OtpCodeInput } from "@/components/auth/otp-code-input";
import { REFUSED_MESSAGE, useStaffSignIn } from "@/components/auth/use-staff-sign-in";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  clearVerificationTarget,
  maskVerificationTarget,
  parseVerificationTarget,
  RESEND_DELAY_SECONDS,
  readResendSecondsLeft,
  readStoredVerificationTarget,
  readVerificationTarget,
  startResendCooldown,
} from "@/lib/auth-flow";
import { requestSignInCode, verifySignInCode } from "@/lib/auth-actions";
import { authErrorMessage } from "@/lib/auth-errors";

const subscribe = () => () => {};
const getServerTarget = () => null;

export function VerifyOtpView() {
  const router = useRouter();
  const signIn = useStaffSignIn();
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_DELAY_SECONDS);
  const [error, setError] = useState<string | null>(null);

  const target = parseVerificationTarget(
    useSyncExternalStore(subscribe, readStoredVerificationTarget, getServerTarget),
  );
  const isComplete = code.length === OTP_CODE_LENGTH;

  useEffect(() => {
    if (readVerificationTarget()?.flow !== "sign-in") router.replace("/login");
  }, [router]);

  useEffect(() => {
    const tick = () => setSecondsLeft(readResendSecondsLeft());
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, []);

  async function handleVerify(value: string) {
    if (isLoading || value.length !== OTP_CODE_LENGTH || !target) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await verifySignInCode(target, value);
      clearVerificationTarget();
      await signIn.handle(result);
    } catch (err) {
      setError(authErrorMessage(err));
      setCode("");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResend() {
    if (secondsLeft > 0 || !target) return;
    setError(null);
    setIsResending(true);
    try {
      await requestSignInCode(target);
      startResendCooldown();
      setSecondsLeft(RESEND_DELAY_SECONDS);
      setCode("");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsResending(false);
    }
  }

  const message = signIn.refused ? REFUSED_MESSAGE : error;

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void handleVerify(code);
        }}
        className="flex w-full max-w-sm flex-col items-center gap-6"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight">Vérifiez votre connexion</h1>
          <p className="min-h-4 text-xs text-muted-foreground">
            {target ? (
              <>
                Saisissez le code envoyé à{" "}
                <span className="font-medium text-foreground">
                  {maskVerificationTarget(target)}
                </span>
              </>
            ) : (
              " "
            )}
          </p>
        </div>

        <OtpCodeInput
          value={code}
          onChange={(value) => {
            setCode(value);
            setError(null);
            if (value.length === OTP_CODE_LENGTH) void handleVerify(value);
          }}
          disabled={isLoading}
          autoFocus
          aria-label="Code de vérification"
        />

        {message && (
          <p role="alert" className="-mt-2 text-center text-xs text-destructive">
            {message}
          </p>
        )}

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
            href="/login"
            className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-foreground/80 underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:underline"
          >
            <ChevronLeft className="size-3.5" />
            Retour à la connexion
          </Link>
        </div>
      </form>
      {signIn.dialogs}
    </div>
  );
}
