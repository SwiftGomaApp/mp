"use client";

import { useState } from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import type { ActivityItem } from "swiftgoma-mp-auth/account";

import { useLogout } from "@/components/auth/logout-screen";
import { formatDateTime, formatPlace } from "@/components/dashboard/format-date";
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
import { authErrorMessage } from "@/lib/auth-errors";
import { type SuspiciousActivityReport, usersApi } from "@/lib/users-api";

interface NotMeDialogProps {
  /** The activity the user does not recognise, or null when the dialog is closed. */
  item: ActivityItem | null;
  /** The label shown for that activity. */
  eventLabel: string;
  onClose: () => void;
}

export function NotMeDialog(props: NotMeDialogProps) {
  return props.item ? <NotMeFlow {...props} item={props.item} /> : null;
}

function NotMeFlow({ item, eventLabel, onClose }: NotMeDialogProps & { item: ActivityItem }) {
  const { logout, isLoggingOut } = useLogout();
  const [report, setReport] = useState<SuspiciousActivityReport | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const place = formatPlace(item.city, item.country);
  const details = [item.deviceName, place].filter(Boolean).join(" · ");

  async function handleReport() {
    if (isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      setReport(await usersApi.reportNotMe(item.id));
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }

  // Every session is closed on the server, this one included: go back to the sign-in page.
  function handleDone() {
    void logout();
  }

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (next || isLoading || isLoggingOut) return;
        if (report) handleDone();
        else onClose();
      }}
    >
      <DialogContent className="gap-5 sm:max-w-md" showCloseButton={!report}>
        {report ? (
          <>
            <DialogHeader className="items-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 ring-8 ring-emerald-500/5 dark:text-emerald-400">
                <ShieldCheck className="size-5" />
              </span>
              <DialogTitle>Votre compte est sécurisé</DialogTitle>
              <DialogDescription>
                {report.loggedOutDevices > 0
                  ? `${report.loggedOutDevices} appareil${report.loggedOutDevices > 1 ? "s ont" : " a"} été déconnecté${report.loggedOutDevices > 1 ? "s" : ""}. `
                  : ""}
                {report.passwordCleared ? "Votre mot de passe a été supprimé. " : ""}
                Reconnectez-vous avec un code, puis ajoutez un nouveau mot de passe dans l’onglet
                Sécurité. Le Support a été prévenu.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={handleDone} disabled={isLoggingOut}>
                {isLoggingOut && <Spinner data-icon="inline-start" />}
                Me reconnecter
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader className="items-center gap-3 text-center">
              <span className="flex size-12 items-center justify-center rounded-full bg-destructive/10 text-destructive ring-8 ring-destructive/5">
                <ShieldAlert className="size-5" />
              </span>
              <DialogTitle>Ce n’était pas vous ?</DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{eventLabel}</span>
                {details && <> · {details}</>}
                <br />
                {formatDateTime(item.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-2 rounded-xl border bg-muted/30 p-3.5 text-xs text-muted-foreground">
              <p className="text-sm font-medium text-foreground">
                Pour vous protéger, nous allons :
              </p>
              <ul className="grid list-disc gap-1 pl-4">
                <li>vous déconnecter de tous vos appareils, y compris celui-ci ;</li>
                <li>supprimer votre mot de passe ;</li>
                <li>prévenir le Support pour qu’il vous aide.</li>
              </ul>
            </div>

            {error && <ErrorText>{error}</ErrorText>}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={isLoading}>
                Annuler
              </Button>
              <Button
                variant="destructive"
                onClick={() => void handleReport()}
                disabled={isLoading}
              >
                {isLoading && <Spinner data-icon="inline-start" />}
                Sécuriser mon compte
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
