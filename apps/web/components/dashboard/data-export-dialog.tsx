"use client";

import { useState } from "react";

import { OTP_CODE_LENGTH } from "@/components/auth/otp-code-input";
import { StepUpCodeField } from "@/components/dashboard/step-up-code-field";
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
import { usersApi } from "@/lib/users-api";

interface DataExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExported?: () => void;
}

function downloadJson(data: unknown) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `swiftgoma-donnees-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function DataExportDialog(props: DataExportDialogProps) {
  return props.open ? <ExportFlow {...props} /> : null;
}

function ExportFlow({ open, onOpenChange, onExported }: DataExportDialogProps) {
  const [code, setCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || code.length !== OTP_CODE_LENGTH) return;
    setIsLoading(true);
    setError(null);
    try {
      downloadJson(await usersApi.exportData(code));
      onExported?.();
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
        <form onSubmit={handleSubmit} className="grid gap-5">
          <DialogHeader>
            <DialogTitle>Télécharger mes données</DialogTitle>
            <DialogDescription>
              Vous recevez un fichier JSON avec les informations liées à votre compte. Il peut être
              limité à 3 exports par heure.
            </DialogDescription>
          </DialogHeader>

          <StepUpCodeField
            value={code}
            onChange={setCode}
            disabled={isLoading}
            error={error}
            onError={setError}
          />

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Annuler
            </Button>
            <Button type="submit" disabled={isLoading || code.length !== OTP_CODE_LENGTH}>
              {isLoading && <Spinner data-icon="inline-start" />}
              Télécharger
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
