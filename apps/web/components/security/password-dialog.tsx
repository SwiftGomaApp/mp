"use client";

import { useEffect, useState } from "react";
import { ChevronRight, KeyRound, ShieldOff } from "lucide-react";

import { OTP_CODE_LENGTH, OtpCodeInput } from "@/components/auth/otp-code-input";
import { PasswordField } from "@/components/auth/password-field";
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
import { Spinner } from "@/components/ui/spinner";
import { account } from "@/lib/account";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";

const MIN_PASSWORD_LENGTH = 8;

type View = "menu" | "create" | "change" | "remove";

interface StepUp {
  /** True when the code to give is the one from the authenticator app. */
  authenticator: boolean;
  /** Where the code was sent, when it was sent. */
  sentTo: string | null;
}

/** With two-step verification on, the app code is the step-up code; otherwise one is sent. */
async function loadStepUp(): Promise<StepUp> {
  const { enabled } = await account.twoFactor.status();
  if (enabled) return { authenticator: true, sentTo: null };
  const sent = await auth.stepUp.request();
  return { authenticator: false, sentTo: sent.target };
}

const FORM_COPY: Record<
  Exclude<View, "menu">,
  { title: string; description: string; submit: string }
> = {
  create: {
    title: "Ajouter un mot de passe",
    description: "Une méthode de connexion de plus, pour ne jamais être bloqué.",
    submit: "Ajouter le mot de passe",
  },
  change: {
    title: "Changer le mot de passe",
    description: "Saisissez votre mot de passe actuel, puis choisissez-en un nouveau.",
    submit: "Changer le mot de passe",
  },
  remove: {
    title: "Supprimer le mot de passe",
    description:
      "Vous vous connecterez avec un code, Google ou une clé d’accès. Votre compte doit garder au moins une autre méthode de connexion.",
    submit: "Supprimer",
  },
};

interface PasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Whether the account already has a password: it decides between adding and managing it. */
  hasPassword: boolean;
}

export function PasswordDialog(props: PasswordDialogProps) {
  return props.open ? <PasswordFlow {...props} /> : null;
}

function PasswordFlow({ open, onOpenChange, hasPassword }: PasswordDialogProps) {
  const [view, setView] = useState<View>(hasPassword ? "menu" : "create");
  const [stepUp, setStepUp] = useState<StepUp | null>(null);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Adding a password starts on the form, so its code is sent as soon as the dialog opens.
  useEffect(() => {
    if (hasPassword) return;
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
  }, [hasPassword]);

  /** Opens a form and sends the code it needs. */
  function openForm(next: Exclude<View, "menu">) {
    setView(next);
    setStepUp(null);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setCode("");
    setError(null);
    loadStepUp()
      .then(setStepUp)
      .catch((err) => setError(authErrorMessage(err)));
  }

  const needsNewPassword = view === "create" || view === "change";
  const passwordsMatch = newPassword === confirmPassword;
  const isValid =
    code.length === OTP_CODE_LENGTH &&
    (!needsNewPassword || (newPassword.length >= MIN_PASSWORD_LENGTH && passwordsMatch)) &&
    (view !== "change" || currentPassword.length > 0);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || !isValid || view === "menu") return;
    setIsLoading(true);
    setError(null);
    try {
      if (view === "create") await auth.password.create({ password: newPassword, code });
      else if (view === "change") {
        await auth.password.change({ currentPassword, newPassword, code });
      } else await auth.password.remove({ code });
      onOpenChange(false);
    } catch (err) {
      setError(authErrorMessage(err));
      setCode("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !isLoading && onOpenChange(next)}>
      <DialogContent className="gap-5 sm:max-w-md">
        {view === "menu" && (
          <>
            <DialogHeader>
              <DialogTitle>Mot de passe</DialogTitle>
              <DialogDescription>
                Votre compte peut se connecter avec un mot de passe.
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2">
              <button
                type="button"
                onClick={() => openForm("change")}
                className="flex items-center gap-3 rounded-xl border p-3 text-left transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                <KeyRound className="size-5 shrink-0 text-muted-foreground" />
                <span className="grid flex-1 gap-0.5">
                  <span className="text-sm font-medium">Changer le mot de passe</span>
                  <span className="text-xs text-muted-foreground">
                    Choisissez un nouveau mot de passe
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => openForm("remove")}
                className="flex items-center gap-3 rounded-xl border p-3 text-left text-destructive transition-colors outline-none hover:bg-destructive/5 focus-visible:ring-3 focus-visible:ring-destructive/30"
              >
                <ShieldOff className="size-5 shrink-0" />
                <span className="grid flex-1 gap-0.5">
                  <span className="text-sm font-medium">Supprimer le mot de passe</span>
                  <span className="text-xs text-muted-foreground">
                    Se connecter sans mot de passe
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0" />
              </button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Fermer
              </Button>
            </DialogFooter>
          </>
        )}

        {view !== "menu" && (
          <form onSubmit={handleSubmit} className="grid gap-5">
            <DialogHeader>
              <DialogTitle>{FORM_COPY[view].title}</DialogTitle>
              <DialogDescription>{FORM_COPY[view].description}</DialogDescription>
            </DialogHeader>

            {view === "change" && (
              <PasswordField
                id="current-password"
                label="Mot de passe actuel"
                value={currentPassword}
                onChange={setCurrentPassword}
                autoComplete="current-password"
                disabled={isLoading}
                autoFocus
              />
            )}

            {needsNewPassword && (
              <div className="grid gap-3">
                <PasswordField
                  id="new-password"
                  label="Nouveau mot de passe"
                  value={newPassword}
                  onChange={setNewPassword}
                  autoComplete="new-password"
                  disabled={isLoading}
                  autoFocus={view === "create"}
                />
                <PasswordField
                  id="confirm-password"
                  label="Confirmer le mot de passe"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  autoComplete="new-password"
                  disabled={isLoading}
                />
                {newPassword.length > 0 && newPassword.length < MIN_PASSWORD_LENGTH && (
                  <p className="text-xs text-muted-foreground">
                    Au moins {MIN_PASSWORD_LENGTH} caractères.
                  </p>
                )}
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <ErrorText>Les mots de passe ne correspondent pas.</ErrorText>
                )}
              </div>
            )}

            <div className="flex flex-col items-center gap-3">
              <p className="text-center text-xs text-muted-foreground">
                {stepUp?.authenticator
                  ? "Code de votre application d’authentification"
                  : stepUp?.sentTo
                    ? `Code de vérification envoyé à ${stepUp.sentTo}`
                    : "Nous vous envoyons un code de vérification…"}
              </p>
              <OtpCodeInput
                value={code}
                onChange={(value) => {
                  setCode(value);
                  setError(null);
                }}
                disabled={isLoading || !stepUp}
                invalid={!!error}
                autoFocus={view === "remove"}
                aria-label="Code de vérification"
              />
              {error && <ErrorText>{error}</ErrorText>}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => (hasPassword ? setView("menu") : onOpenChange(false))}
                disabled={isLoading}
              >
                {hasPassword ? "Retour" : "Annuler"}
              </Button>
              <Button
                type="submit"
                variant={view === "remove" ? "destructive" : "default"}
                disabled={isLoading || !isValid}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                {FORM_COPY[view].submit}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
