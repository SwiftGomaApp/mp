"use client";

import { useEffect, useState } from "react";
import { Check, Fingerprint, Pencil, Plus, Trash2, X } from "lucide-react";
import type { Passkey } from "swiftgoma-mp-auth/account";

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
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { account } from "@/lib/account";
import { authErrorMessage } from "@/lib/auth-errors";

const MAX_NAME_LENGTH = 60;

const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "numeric", month: "short", year: "numeric" }).format(
    new Date(iso),
  );

interface PasskeyManageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Asks the parent to close this dialog and open the creation one. */
  onAdd: () => void;
}

export function PasskeyManageDialog(props: PasskeyManageDialogProps) {
  return props.open ? <PasskeyManageFlow {...props} /> : null;
}

function PasskeyManageFlow({ open, onOpenChange, onAdd }: PasskeyManageDialogProps) {
  const [passkeys, setPasskeys] = useState<Passkey[] | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    account.passkeys
      .list()
      .then((result) => {
        if (!cancelled) setPasskeys(result);
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function startRename(passkey: Passkey) {
    setRemovingId(null);
    setRenamingId(passkey.id);
    setName(passkey.name);
    setError(null);
  }

  async function saveRename(passkey: Passkey) {
    const trimmed = name.trim();
    if (!trimmed || trimmed === passkey.name) return setRenamingId(null);
    setBusyId(passkey.id);
    setError(null);
    try {
      await account.passkeys.rename(passkey.id, trimmed);
      setPasskeys(
        (current) =>
          current?.map((item) => (item.id === passkey.id ? { ...item, name: trimmed } : item)) ??
          null,
      );
      setRenamingId(null);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function remove(passkey: Passkey) {
    setBusyId(passkey.id);
    setError(null);
    try {
      await account.passkeys.remove(passkey.id);
      setPasskeys((current) => current?.filter((item) => item.id !== passkey.id) ?? null);
      setRemovingId(null);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busyId && onOpenChange(next)}>
      <DialogContent className="gap-5 sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Clés d’accès</DialogTitle>
          <DialogDescription>
            Connectez-vous avec la biométrie, une clé de sécurité ou un code PIN. Renommez ou
            supprimez les clés de vos appareils.
          </DialogDescription>
        </DialogHeader>

        {error && <ErrorText>{error}</ErrorText>}

        <ul className="grid gap-2">
          {!passkeys && !error && (
            <>
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </>
          )}

          {passkeys?.length === 0 && (
            <li className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
              Aucune clé d’accès enregistrée.
            </li>
          )}

          {passkeys?.map((passkey) => {
            const isBusy = busyId === passkey.id;
            const isRenaming = renamingId === passkey.id;
            const isRemoving = removingId === passkey.id;

            return (
              <li key={passkey.id} className="flex items-center gap-3 rounded-xl border p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Fingerprint className="size-5" />
                </span>

                {isRenaming ? (
                  <form
                    className="flex min-w-0 flex-1 items-center gap-1"
                    onSubmit={(event) => {
                      event.preventDefault();
                      void saveRename(passkey);
                    }}
                  >
                    <Input
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      maxLength={MAX_NAME_LENGTH}
                      autoFocus
                      disabled={isBusy}
                      aria-label="Nom de la clé d’accès"
                      className="h-8"
                    />
                    <Button
                      type="submit"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Enregistrer le nom"
                      disabled={isBusy || !name.trim()}
                    >
                      {isBusy ? <Spinner /> : <Check />}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Annuler"
                      disabled={isBusy}
                      onClick={() => setRenamingId(null)}
                    >
                      <X />
                    </Button>
                  </form>
                ) : (
                  <div className="grid min-w-0 flex-1 gap-0.5">
                    <p className="truncate text-sm font-medium">{passkey.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Créée le {formatDate(passkey.createdAt)} ·{" "}
                      {passkey.lastUsedAt
                        ? `utilisée le ${formatDate(passkey.lastUsedAt)}`
                        : "jamais utilisée"}
                    </p>
                  </div>
                )}

                {!isRenaming &&
                  (isRemoving ? (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isBusy}
                        onClick={() => remove(passkey)}
                      >
                        {isBusy && <Spinner data-icon="inline-start" />}
                        Supprimer
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Annuler la suppression"
                        disabled={isBusy}
                        onClick={() => setRemovingId(null)}
                      >
                        <X />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Renommer ${passkey.name}`}
                        onClick={() => startRename(passkey)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Supprimer ${passkey.name}`}
                        onClick={() => {
                          setRenamingId(null);
                          setRemovingId(passkey.id);
                        }}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  ))}
              </li>
            );
          })}
        </ul>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={!!busyId}>
            Fermer
          </Button>
          <Button onClick={onAdd} disabled={!passkeys || !!busyId}>
            <Plus />
            Ajouter une clé d’accès
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
