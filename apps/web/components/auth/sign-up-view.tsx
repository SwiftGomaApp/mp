"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bike, ShoppingBag, Store, type LucideIcon } from "lucide-react";

import { LegalLink, ROLE_TERMS } from "@/components/auth/legal-links";
import { ContactField, useContactField } from "@/components/auth/contact-field";
import { SocialButtons } from "@/components/auth/social-buttons";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Spinner } from "@/components/ui/spinner";
import { type SignUpRole, requestSignUp, signUpWithGoogle } from "@/lib/auth-actions";
import { authErrorMessage } from "@/lib/auth-errors";
import { saveVerificationTarget, POST_LOGIN_PATH } from "@/lib/auth-flow";

const MIN_NAME_LENGTH = 2;

type Step = 1 | 2 | 3;

const STEPS: Record<Step, { title: string; subtitle: string }> = {
  1: { title: "Que souhaitez-vous faire ?", subtitle: "Choisissez comment utiliser SwiftGoma" },
  2: { title: "Confirmez votre âge", subtitle: "Dernière vérification avant de continuer" },
  3: { title: "Créez votre compte", subtitle: "Choisissez comment vous inscrire" },
};

const ROLE_OPTIONS: {
  value: SignUpRole;
  label: string;
  description: string;
  icon: LucideIcon;
}[] = [
  {
    value: "BUYER",
    label: "Acheter",
    description: "Trouvez des produits à Goma et recevez-les chez vous.",
    icon: ShoppingBag,
  },
  {
    value: "SELLER",
    label: "Vendre",
    description: "Ouvrez votre boutique et touchez de nouveaux clients.",
    icon: Store,
  },
  {
    value: "RIDER",
    label: "Livrer",
    description: "Livrez des commandes et gagnez de l’argent.",
    icon: Bike,
  },
];

function StepProgress({ step }: { step: Step }) {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <div className="flex w-full gap-1.5" aria-hidden="true">
        {([1, 2, 3] as const).map((value) => (
          <span
            key={value}
            className={`h-1 flex-1 rounded-full transition-colors ${value <= step ? "bg-primary" : "bg-muted"}`}
          />
        ))}
      </div>
      <p className="text-xs text-muted-foreground">Étape {step} sur 3</p>
    </div>
  );
}

function BackButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1 self-start text-xs font-medium text-foreground/80 underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:underline disabled:pointer-events-none disabled:opacity-50"
    >
      <ArrowLeft className="size-3.5" />
      Retour
    </button>
  );
}

export function SignUpView() {
  const router = useRouter();
  const contact = useContactField();
  const [step, setStep] = useState<Step>(1);
  const [role, setRole] = useState<SignUpRole | null>(null);
  const [confirmedAge, setConfirmedAge] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const trimmedName = fullName.trim().replace(/\s+/g, " ");
  const isFormValid = trimmedName.length >= MIN_NAME_LENGTH && contact.isValid;
  const copy = STEPS[step];

  function goTo(next: Step) {
    setError(null);
    setStep(next);
  }

  async function handleGoogle() {
    if (isLoading || !role) return;
    setIsLoading(true);
    setError(null);
    try {
      const outcome = await signUpWithGoogle(role);
      if (outcome === "authenticated") router.push(POST_LOGIN_PATH);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || !isFormValid || !role) return;
    setIsLoading(true);
    setError(null);
    try {
      await requestSignUp({
        method: contact.method,
        value: contact.contact,
        name: trimmedName,
        role,
      });
      saveVerificationTarget({
        flow: "sign-up",
        method: contact.method,
        value: contact.contact,
        fullName: trimmedName,
        role,
      });
      router.push("/auth/sign-up/verify");
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex w-full max-w-sm flex-col items-center gap-6">
        <StepProgress step={step} />

        <div className="flex flex-col items-center gap-3 text-center">
          <Image src="/logo-icon.png" alt="SwiftGoma" width={48} height={48} priority />
          <h1 className="text-2xl font-bold tracking-tight">{copy.title}</h1>
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {copy.subtitle}
          </p>
        </div>

        {step === 1 && (
          <div className="flex w-full flex-col gap-5 animate-in fade-in slide-in-from-right-4">
            <RadioGroup
              value={role ?? ""}
              onValueChange={(value) => setRole(value as SignUpRole)}
              aria-label="Votre rôle sur SwiftGoma"
              className="gap-2.5"
            >
              {ROLE_OPTIONS.map(({ value, label, description, icon: Icon }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-3 rounded-xl border p-3.5 transition-colors hover:bg-muted/50 has-data-checked:border-primary has-data-checked:bg-primary/5"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="grid flex-1 gap-0.5">
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-xs text-muted-foreground">{description}</span>
                  </span>
                  <RadioGroupItem value={value} />
                </label>
              ))}
            </RadioGroup>

            <Button
              type="button"
              variant={role ? "default" : "secondary"}
              size="lg"
              className="w-full"
              disabled={!role}
              onClick={() => goTo(2)}
            >
              Continuer
            </Button>
            <FieldDescription className="text-center">
              Vous avez déjà un compte ? <Link href="/auth/sign-in">Connectez-vous</Link>
            </FieldDescription>
          </div>
        )}

        {step === 2 && (
          <div className="flex w-full flex-col gap-5 animate-in fade-in slide-in-from-right-4">
            <div className="grid gap-4 rounded-xl border p-4 text-sm">
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={confirmedAge}
                  onCheckedChange={(checked) => setConfirmedAge(checked === true)}
                  className="mt-0.5"
                />
                <span>Je confirme avoir l’âge minimum requis pour créer un compte SwiftGoma.</span>
              </label>
              <label className="flex cursor-pointer items-start gap-3">
                <Checkbox
                  checked={acceptedTerms}
                  onCheckedChange={(checked) => setAcceptedTerms(checked === true)}
                  className="mt-0.5"
                />
                <span>
                  J’accepte les <LegalLink href="/legale/terms">conditions d’utilisation</LegalLink>
                  {role && (
                    <>
                      , les{" "}
                      <LegalLink href={ROLE_TERMS[role].href}>{ROLE_TERMS[role].label}</LegalLink>
                    </>
                  )}{" "}
                  et la <LegalLink href="/legale/privacy">politique de confidentialité</LegalLink>{" "}
                  de SwiftGoma.
                </span>
              </label>
            </div>

            <Button
              type="button"
              variant={confirmedAge && acceptedTerms ? "default" : "secondary"}
              size="lg"
              className="w-full"
              disabled={!confirmedAge || !acceptedTerms}
              onClick={() => goTo(3)}
            >
              Continuer
            </Button>
            <BackButton onClick={() => goTo(1)} />
          </div>
        )}

        {step === 3 && (
          <form className="w-full animate-in fade-in slide-in-from-right-4" onSubmit={handleSubmit}>
            <FieldGroup className="items-center">
              <SocialButtons verb="S’inscrire" disabled={isLoading} onGoogle={handleGoogle} />

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

              {error && (
                <p role="alert" className="text-center text-xs text-destructive">
                  {error}
                </p>
              )}

              <Field>
                <Button
                  type="submit"
                  variant={isFormValid ? "default" : "secondary"}
                  size="lg"
                  className="w-full"
                  disabled={isLoading || !isFormValid}
                >
                  {isLoading && <Spinner data-icon="inline-start" />}
                  {isLoading ? "Chargement…" : "Continuer"}
                </Button>
              </Field>

              <BackButton onClick={() => goTo(2)} disabled={isLoading} />
            </FieldGroup>
          </form>
        )}
      </div>
    </div>
  );
}
