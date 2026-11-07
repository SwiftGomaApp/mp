"use client";

import { useRef, useState } from "react";
import { Check, FileUp, Trash2 } from "lucide-react";
import { hasErrorCode } from "swiftgoma-mp-auth";

import { ErrorText } from "@/components/security/recovery-codes-step";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authErrorMessage } from "@/lib/auth-errors";
import {
  IMAGE_ONLY_DOCUMENTS,
  type MyVerification,
  TAX_NUMBER_LIMITS,
  VERIFICATION_DOCUMENT_TYPES,
  VERIFICATION_FILE_MAX_BYTES,
  VERIFICATION_IMAGE_TYPES,
  type VerificationDocument,
  type VerificationDocumentType,
  verificationApi,
} from "@/lib/verification-api";
import { Reveal } from "@/components/global/reveal";
import { cn } from "cn";

export const DOCUMENT_COPY: Record<
  VerificationDocumentType,
  { title: string; description: string }
> = {
  ID_CARD: {
    title: "Pièce d’identité",
    description: "Carte d’électeur, passeport ou permis. Photo ou PDF lisible.",
  },
  SELFIE: {
    title: "Selfie",
    description: "Une photo de votre visage, bien éclairée, avec votre pièce d’identité.",
  },
  PROOF_OF_ADDRESS: {
    title: "Justificatif de domicile",
    description: "Facture ou attestation de résidence récente.",
  },
  SHOP_PHOTO: {
    title: "Photo de la boutique",
    description: "Une photo de votre boutique ou de votre lieu de vente.",
  },
  RCCM: {
    title: "RCCM",
    description: "Registre du commerce, si vous en avez un (facultatif).",
  },
};

const STEPS = ["Informations", "Documents", "Envoi"] as const;

const formatSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} Ko`
    : `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;

function uploadErrorMessage(error: unknown) {
  if (hasErrorCode(error, "FILE_TOO_LARGE")) return "Ce fichier est trop lourd (5 Mo maximum).";
  if (hasErrorCode(error, ["INVALID_FILE_TYPE", "INVALID_UPLOAD", "FILE_REQUIRED"])) {
    return "Format non accepté. Envoyez une photo JPEG, PNG ou WebP, ou un PDF si c’est permis.";
  }
  return authErrorMessage(error);
}

function Stepper({ current, completed }: { current: number; completed: boolean[] }) {
  return (
    <ol className="flex items-center gap-2" aria-label="Étapes de la vérification">
      {STEPS.map((label, index) => {
        const isDone = completed[index];
        const isCurrent = index === current;

        return (
          <li
            key={label}
            aria-current={isCurrent ? "step" : undefined}
            className="flex flex-1 items-center gap-2 last:flex-none"
          >
            <span
              className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
                isDone && !isCurrent && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                isCurrent && "bg-primary text-primary-foreground",
                !isDone && !isCurrent && "bg-muted text-muted-foreground",
              )}
            >
              {isDone && !isCurrent ? <Check className="size-4" /> : index + 1}
            </span>
            <span
              className={cn(
                "hidden text-sm font-medium sm:inline",
                isCurrent ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {label}
            </span>
            {index < STEPS.length - 1 && <span className="h-px flex-1 bg-border" aria-hidden />}
          </li>
        );
      })}
    </ol>
  );
}

function DocumentRow({
  type,
  required,
  sent,
  busy,
  disabled,
  onUpload,
  onRemove,
}: {
  type: VerificationDocumentType;
  required: boolean;
  sent: VerificationDocument | undefined;
  busy: boolean;
  disabled: boolean;
  onUpload: (type: VerificationDocumentType, file: File) => void;
  onRemove: (type: VerificationDocumentType) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { title, description } = DOCUMENT_COPY[type];
  const accepted = IMAGE_ONLY_DOCUMENTS.includes(type)
    ? VERIFICATION_IMAGE_TYPES
    : VERIFICATION_DOCUMENT_TYPES;

  return (
    <li className="flex items-center gap-4 rounded-xl border bg-card p-4">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-lg",
          sent
            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
            : "bg-primary/10 text-primary",
        )}
      >
        {sent ? <Check className="size-5" /> : <FileUp className="size-5" />}
      </span>

      <div className="grid min-w-0 flex-1 gap-0.5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold">{title}</p>
          {!required && (
            <Badge variant="secondary" className="border-0">
              Facultatif
            </Badge>
          )}
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          {sent ? `Envoyé · ${formatSize(sent.sizeBytes)}` : description}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        hidden
        accept={accepted.join(",")}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) onUpload(type, file);
        }}
      />
      <div className="flex shrink-0 gap-1">
        <Button
          size="sm"
          variant={sent ? "outline" : "default"}
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
        >
          {busy && <Spinner data-icon="inline-start" />}
          {sent ? "Remplacer" : "Envoyer"}
        </Button>
        {sent && (
          <Button
            size="icon-sm"
            variant="ghost"
            disabled={disabled || busy}
            onClick={() => onRemove(type)}
            aria-label={`Retirer ${title}`}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 />
          </Button>
        )}
      </div>
    </li>
  );
}

interface SellerVerificationProps {
  data: MyVerification;
  onChange: (data: MyVerification) => void;
}

/** The draft file: three steps, from the tax number to the final submission. */
export function SellerVerification({ data, onChange }: SellerVerificationProps) {
  const draft = data.case;
  const [step, setStep] = useState(0);
  const [taxNumber, setTaxNumber] = useState(draft?.taxNumber ?? "");
  const [busyDocument, setBusyDocument] = useState<VerificationDocumentType | null>(null);
  const [action, setAction] = useState<"details" | "submit" | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!draft || !data.checklist) return null;

  const { required, optional } = data.checklist;
  const sentByType = new Map(draft.documents.map((doc) => [doc.type, doc]));
  const trimmedTax = taxNumber.trim();
  // Optional: empty is fine, but a number that is given must have a plausible length.
  const taxValid =
    trimmedTax.length === 0 ||
    (trimmedTax.length >= TAX_NUMBER_LIMITS.min && trimmedTax.length <= TAX_NUMBER_LIMITS.max);
  const allSent = required.every((item) => item.sent);
  const isBusy = action !== null || busyDocument !== null;
  const completed = [step > 0, allSent, false];

  function goTo(next: number) {
    setError(null);
    setStep(next);
  }

  async function saveDetailsAndContinue() {
    if (isBusy || !taxValid) return;
    setAction("details");
    setError(null);
    try {
      if (trimmedTax && trimmedTax !== (draft?.taxNumber ?? "")) {
        await verificationApi.saveDetails({ taxNumber: trimmedTax });
        onChange(await verificationApi.getMine());
      }
      setStep(1);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setAction(null);
    }
  }

  async function upload(type: VerificationDocumentType, file: File) {
    if (isBusy) return;
    const imageOnly = IMAGE_ONLY_DOCUMENTS.includes(type);
    const accepted = imageOnly ? VERIFICATION_IMAGE_TYPES : VERIFICATION_DOCUMENT_TYPES;
    if (!accepted.includes(file.type)) {
      setError(
        imageOnly
          ? "Une photo est attendue (JPEG, PNG ou WebP)."
          : "Format non accepté. Envoyez une photo JPEG, PNG ou WebP, ou un PDF.",
      );
      return;
    }
    if (file.size > VERIFICATION_FILE_MAX_BYTES) {
      setError("Ce fichier est trop lourd (5 Mo maximum).");
      return;
    }
    setBusyDocument(type);
    setError(null);
    try {
      await verificationApi.uploadDocument(type, file);
      onChange(await verificationApi.getMine());
    } catch (err) {
      setError(uploadErrorMessage(err));
    } finally {
      setBusyDocument(null);
    }
  }

  async function remove(type: VerificationDocumentType) {
    if (isBusy) return;
    setBusyDocument(type);
    setError(null);
    try {
      await verificationApi.removeDocument(type);
      onChange(await verificationApi.getMine());
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusyDocument(null);
    }
  }

  async function submit() {
    if (isBusy) return;
    setAction("submit");
    setError(null);
    try {
      onChange(await verificationApi.submit());
    } catch (err) {
      setError(authErrorMessage(err));
      setAction(null);
    }
  }

  const documentRows = (items: typeof required, isRequired: boolean) =>
    items.map((item) => (
      <DocumentRow
        key={item.type}
        type={item.type}
        required={isRequired}
        sent={sentByType.get(item.type)}
        busy={busyDocument === item.type}
        disabled={isBusy}
        onUpload={upload}
        onRemove={remove}
      />
    ));

  return (
    <div className="grid gap-6">
      <Reveal>
        <div className="grid gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Vérifiez votre identité</h1>
            <Badge variant="secondary" className="border-0">
              Essai {draft.attempt} sur 3
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Quelques minutes suffisent. Vos documents restent confidentiels.
          </p>
        </div>
      </Reveal>

      <Reveal delay={100}>
        <Stepper current={step} completed={completed} />
      </Reveal>

      {step === 0 && (
        <Reveal>
          <section className="grid gap-4 rounded-xl border bg-card p-4">
            <div className="grid gap-0.5">
              <h2 className="font-semibold">Informations de votre activité</h2>
              <p className="text-sm text-muted-foreground">
                Le numéro d’impôt (NIF) est facultatif : tout le monde n’en a pas. Vous pouvez le
                laisser vide.
              </p>
            </div>
            <Field>
              <FieldLabel htmlFor="tax-number">Numéro d’impôt (NIF) · facultatif</FieldLabel>
              <Input
                id="tax-number"
                autoComplete="off"
                value={taxNumber}
                maxLength={TAX_NUMBER_LIMITS.max}
                onChange={(event) => setTaxNumber(event.target.value)}
                disabled={isBusy}
                className="h-10 max-w-72"
                autoFocus
              />
            </Field>
            <div className="flex justify-end">
              <Button disabled={isBusy || !taxValid} onClick={() => void saveDetailsAndContinue()}>
                {action === "details" && <Spinner data-icon="inline-start" />}
                {trimmedTax ? "Continuer" : "Continuer sans NIF"}
              </Button>
            </div>
          </section>
        </Reveal>
      )}

      {step === 1 && (
        <Reveal>
          <section className="grid gap-4">
            <div className="grid gap-0.5">
              <h2 className="font-semibold">Vos documents</h2>
              <p className="text-sm text-muted-foreground">
                {required.filter((item) => item.sent).length} sur {required.length} envoyés · 5 Mo
                maximum par fichier.
              </p>
            </div>
            <ul className="grid gap-3">
              {documentRows(required, true)}
              {documentRows(optional, false)}
            </ul>
            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={isBusy} onClick={() => goTo(0)}>
                Retour
              </Button>
              <Button disabled={isBusy || !allSent} onClick={() => goTo(2)}>
                Continuer
              </Button>
            </div>
          </section>
        </Reveal>
      )}

      {step === 2 && (
        <Reveal>
          <section className="grid gap-4">
            <div className="grid gap-0.5">
              <h2 className="font-semibold">Vérifiez avant d’envoyer</h2>
              <p className="text-sm text-muted-foreground">
                Une fois envoyé, votre dossier ne peut plus être modifié pendant l’examen.
              </p>
            </div>

            <dl className="divide-y rounded-xl border bg-card text-sm">
              <div className="flex items-center justify-between gap-4 p-4">
                <dt className="text-muted-foreground">Numéro d’impôt (NIF)</dt>
                <dd className="font-medium">{draft.taxNumber ?? "Non renseigné"}</dd>
              </div>
              {[...required, ...optional]
                .filter((item) => sentByType.has(item.type))
                .map((item) => (
                  <div key={item.type} className="flex items-center justify-between gap-4 p-4">
                    <dt className="text-muted-foreground">{DOCUMENT_COPY[item.type].title}</dt>
                    <dd className="flex items-center gap-1.5 font-medium text-emerald-600 dark:text-emerald-400">
                      <Check className="size-4" />
                      Envoyé
                    </dd>
                  </div>
                ))}
            </dl>

            <div className="flex justify-between gap-2">
              <Button variant="outline" disabled={isBusy} onClick={() => goTo(1)}>
                Retour
              </Button>
              <Button disabled={isBusy || !allSent} onClick={() => void submit()}>
                {action === "submit" && <Spinner data-icon="inline-start" />}
                Envoyer mon dossier
              </Button>
            </div>
          </section>
        </Reveal>
      )}

      {error && <ErrorText>{error}</ErrorText>}
    </div>
  );
}
