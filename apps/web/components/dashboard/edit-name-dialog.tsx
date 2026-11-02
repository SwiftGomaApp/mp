"use client";

import { useState } from "react";

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
import { Spinner } from "@/components/ui/spinner";
import { authErrorMessage } from "@/lib/auth-errors";
import { NAME_MAX_LENGTH, NAME_MIN_LENGTH } from "@/lib/users-api";

interface EditNameDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentName: string;
  onSave: (name: string) => Promise<void>;
}

function EditNameForm({
  currentName,
  onSave,
  onClose,
}: Pick<EditNameDialogProps, "currentName" | "onSave"> & { onClose: () => void }) {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const trimmed = name.trim().replace(/\s+/g, " ");
  const isValid = trimmed.length >= NAME_MIN_LENGTH && trimmed.length <= NAME_MAX_LENGTH;
  const isChanged = trimmed !== currentName;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSaving || !isValid || !isChanged) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave(trimmed);
      onClose();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Modifier mon nom</DialogTitle>
        <DialogDescription>
          Ce nom apparaît sur votre profil et auprès des autres utilisateurs.
        </DialogDescription>
      </DialogHeader>

      <Field>
        <FieldLabel htmlFor="profile-name">Nom complet</FieldLabel>
        <Input
          id="profile-name"
          name="name"
          autoComplete="name"
          autoFocus
          value={name}
          maxLength={NAME_MAX_LENGTH}
          onChange={(event) => setName(event.target.value)}
          disabled={isSaving}
          className="h-10"
        />
      </Field>

      {error && <ErrorText>{error}</ErrorText>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSaving || !isValid || !isChanged}>
          {isSaving && <Spinner data-icon="inline-start" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}

export function EditNameDialog({ open, onOpenChange, currentName, onSave }: EditNameDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <EditNameForm
          currentName={currentName}
          onSave={onSave}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  );
}
