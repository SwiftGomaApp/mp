"use client";

import { useEffect, useState } from "react";
import { Check, Download, TriangleAlert } from "lucide-react";

import { useLogout } from "@/components/auth/logout-screen";
import { OTP_CODE_LENGTH } from "@/components/auth/otp-code-input";
import { DataExportDialog } from "@/components/dashboard/data-export-dialog";
import { StepUpCodeField } from "@/components/dashboard/step-up-code-field";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { authErrorMessage } from "@/lib/auth-errors";
import { DELETION_CONFIRMATION, type DeletionOverview, usersApi } from "@/lib/users-api";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const KEPT_LABELS: Record<string, string> = {
  ORDERS: "vos commandes",
  PAYMENTS: "vos paiements",
  REVIEWS: "vos avis",
};

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(iso));

export function DeleteAccountDialog(props: DeleteAccountDialogProps) {
  return props.open ? <DeleteFlow {...props} /> : null;
}

function DeleteFlow({ open, onOpenChange }: DeleteAccountDialogProps) {
  const { logout, isLoggingOut } = useLogout();
  const [overview, setOverview] = useState<DeletionOverview | null>(null);
  const [scheduledAt, setScheduledAt] = useState<string | null>(null);
  const [stage, setStage] = useState<"review" | "confirm">("review");
  const [exportOpen, setExportOpen] = useState(false);
  const [exported, setExported] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .getDeletionOverview()
      .then((result) => {
        if (!cancelled) setOverview(result);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const canSubmit =
    overview?.canDelete === true &&
    confirmation.trim() === DELETION_CONFIRMATION &&
    code.length === OTP_CODE_LENGTH;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || !canSubmit) return;
    setIsLoading(true);
    setError(null);
    try {
      const result = await usersApi.requestDeletion(code);
      setScheduledAt(result.scheduledAt);
    } catch (err) {
      setError(authErrorMessage(err));
      setCode("");
    } finally {
      setIsLoading(false);
    }
  }

  // Every session is closed on the server: go back to the sign-in page.
  function handleDone() {
    void logout();
  }

  const kept = overview?.kept.map((key) => KEPT_LABELS[key] ?? key.toLowerCase()) ?? [];

  return (
    <>
      <Dialog
        open={open && !exportOpen}
        onOpenChange={(next) => {
          if (next || isLoading || isLoggingOut) return;
          if (scheduledAt) handleDone();
          else onOpenChange(false);
        }}
      >
        <DialogContent className="max-h-[90svh] gap-5 overflow-y-auto sm:max-w-md">
          {scheduledAt ? (
            <>
              <DialogHeader className="items-center gap-3 text-center">
                <DialogTitle>Suppression programmée</DialogTitle>
                <DialogDescription>
                  Votre compte sera supprimé le {formatDate(scheduledAt)}. Si vous vous reconnectez
                  avant cette date, la suppression est annulée.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button onClick={handleDone} disabled={isLoggingOut}>
                  {isLoggingOut && <Spinner data-icon="inline-start" />}
                  Terminer
                </Button>
              </DialogFooter>
            </>
          ) : (
            <form onSubmit={handleSubmit} className="grid gap-5">
              <DialogHeader className="items-center gap-3 text-center">
                <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-8 ring-destructive/5">
                  <TriangleAlert className="size-5" />
                </span>
                <DialogTitle>Supprimer mon compte</DialogTitle>
                <DialogDescription>
                  Cette action déconnecte tous vos appareils et programme la suppression de votre
                  compte.
                </DialogDescription>
              </DialogHeader>

              {!overview && !error && <Skeleton className="h-24 w-full rounded-xl" />}

              {overview && (
                <div className="grid gap-2 rounded-xl border bg-muted/30 p-3.5 text-xs text-muted-foreground">
                  <ul className="grid list-disc gap-1 pl-4">
                    <li>
                      Délai de réflexion de {overview.gracePeriodDays} jours : vous pouvez annuler
                      en vous reconnectant.
                    </li>
                    <li>
                      Seront effacés : votre profil, vos accès de connexion et vos adresses
                      {overview.erased.addresses > 0 && ` (${overview.erased.addresses})`}.
                    </li>
                    {kept.length > 0 && (
                      <li>Seront conservés pour des raisons légales : {kept.join(", ")}.</li>
                    )}
                  </ul>
                </div>
              )}

              {overview && !overview.canDelete && (
                <ErrorText>
                  Votre compte ne peut pas être supprimé pour le moment. Terminez vos opérations en
                  cours, puis réessayez.
                </ErrorText>
              )}

              {overview?.canDelete && stage === "review" && (
                <div className="grid gap-3 rounded-xl border p-3.5">
                  <div className="grid gap-0.5">
                    <p className="text-sm font-medium">Avant de continuer</p>
                    <p className="text-xs text-muted-foreground">
                      Une fois votre compte supprimé, vos données ne pourront plus être récupérées.
                      Téléchargez-les maintenant si vous voulez en garder une copie.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="justify-self-start"
                    onClick={() => setExportOpen(true)}
                  >
                    {exported ? <Check /> : <Download />}
                    {exported ? "Données téléchargées" : "Télécharger mes données"}
                  </Button>
                </div>
              )}

              {overview?.canDelete && stage === "confirm" && (
                <>
                  <Field>
                    <FieldLabel htmlFor="delete-confirmation">
                      Tapez {DELETION_CONFIRMATION} pour confirmer
                    </FieldLabel>
                    <Input
                      id="delete-confirmation"
                      autoComplete="off"
                      value={confirmation}
                      onChange={(event) => setConfirmation(event.target.value)}
                      disabled={isLoading}
                      className="h-10"
                    />
                  </Field>

                  <StepUpCodeField
                    value={code}
                    onChange={setCode}
                    disabled={isLoading}
                    error={error}
                    onError={setError}
                  />
                </>
              )}

              {error && !overview?.canDelete && <ErrorText>{error}</ErrorText>}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onOpenChange(false)}
                  disabled={isLoading}
                >
                  Annuler
                </Button>
                {stage === "review" ? (
                  <Button
                    type="button"
                    variant="destructive"
                    disabled={!overview?.canDelete}
                    onClick={() => setStage("confirm")}
                  >
                    Continuer
                  </Button>
                ) : (
                  <Button type="submit" variant="destructive" disabled={isLoading || !canSubmit}>
                    {isLoading && <Spinner data-icon="inline-start" />}
                    Supprimer mon compte
                  </Button>
                )}
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
      <DataExportDialog
        open={exportOpen}
        onOpenChange={setExportOpen}
        onExported={() => setExported(true)}
      />
    </>
  );
}
