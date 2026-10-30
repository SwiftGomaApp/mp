"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, KeyRound, Lock, Mail, TriangleAlert } from "lucide-react";

import { TwoFactorDialog } from "@/components/auth/two-factor-dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Spinner } from "@/components/ui/spinner";
import { devRequiresTwoFactor, isValidEmail } from "@/lib/auth-flow";

export function PasswordLoginDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [twoFactorOpen, setTwoFactorOpen] = useState(false);

  const isValid = isValidEmail(email) && password.length > 0;

  function handleOpenChange(next: boolean) {
    if (isLoading) return;
    setOpen(next);
    if (!next) {
      setPassword("");
      setShowPassword(false);
      setCapsLock(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || !isValid) return;
    setIsLoading(true);
    try {
      // TODO: replace with the real email + password sign-in call from the auth package.
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setOpen(false);
      setPassword("");
      if (devRequiresTwoFactor(email)) {
        setTwoFactorOpen(true);
        return;
      }
      router.push("/");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogTrigger
          render={
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium text-foreground/80 underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          }
        >
          <KeyRound className="size-4" />
          Se connecter avec un mot de passe
        </DialogTrigger>

        <DialogContent className="gap-5 p-7 sm:max-w-sm">
          <DialogHeader className="items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary ring-8 ring-primary/5">
              <KeyRound className="size-5" />
            </div>
            <div className="grid gap-1">
              <DialogTitle className="text-lg font-semibold">
                Connexion par mot de passe
              </DialogTitle>
              <DialogDescription className="text-xs">
                Entrez l’adresse e-mail et le mot de passe de votre compte SwiftGoma.
              </DialogDescription>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <FieldGroup className="gap-3">
              <Field className="gap-1.5">
                <FieldLabel htmlFor="password-login-email" className="text-xs">
                  Adresse e-mail
                </FieldLabel>
                <InputGroup className="h-10">
                  <InputGroupAddon>
                    <Mail />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="password-login-email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="username"
                    placeholder="vous@exemple.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={isLoading}
                    required
                  />
                </InputGroup>
              </Field>

              <Field className="gap-1.5">
                <FieldLabel htmlFor="password-login-password" className="text-xs">
                  Mot de passe
                </FieldLabel>
                <InputGroup className="h-10">
                  <InputGroupAddon>
                    <Lock />
                  </InputGroupAddon>
                  <InputGroupInput
                    id="password-login-password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Votre mot de passe"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onKeyDown={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                    onKeyUp={(event) => setCapsLock(event.getModifierState("CapsLock"))}
                    onBlur={() => setCapsLock(false)}
                    disabled={isLoading}
                    required
                  />
                  <InputGroupAddon align="inline-end">
                    <InputGroupButton
                      size="icon-xs"
                      aria-label={
                        showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"
                      }
                      aria-pressed={showPassword}
                      disabled={isLoading}
                      onClick={() => setShowPassword((current) => !current)}
                    >
                      {showPassword ? <EyeOff /> : <Eye />}
                    </InputGroupButton>
                  </InputGroupAddon>
                </InputGroup>
                {capsLock && (
                  <p
                    role="status"
                    className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400"
                  >
                    <TriangleAlert className="size-3.5 shrink-0" />
                    Verr. Maj. est activé
                  </p>
                )}
              </Field>

              <Button
                type="submit"
                variant={isValid ? "default" : "secondary"}
                size="lg"
                className="mt-2 w-full"
                disabled={isLoading || !isValid}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                {isLoading ? "Connexion…" : "Se connecter"}
              </Button>
            </FieldGroup>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Pas de mot de passe sous la main ?{" "}
            <DialogClose
              render={
                <button
                  type="button"
                  className="font-medium text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:text-primary"
                />
              }
            >
              Recevoir un code
            </DialogClose>
          </p>
        </DialogContent>
      </Dialog>

      <TwoFactorDialog
        open={twoFactorOpen}
        onOpenChange={setTwoFactorOpen}
        onVerified={() => router.push("/")}
      />
    </>
  );
}
