"use client";

import { useEffect, useState } from "react";
import { LocateFixed, MapPin, Pencil, Plus, Star, Trash2 } from "lucide-react";

import { AddressDialog } from "@/components/dashboard/address-dialog";
import { mapLink } from "@/components/dashboard/address-location-field";
import { ErrorText } from "@/components/security/recovery-codes-step";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { authErrorMessage } from "@/lib/auth-errors";
import { parseDrcPhone } from "@/lib/phone";
import { type Address, type AddressInput, MAX_ADDRESSES, usersApi } from "@/lib/users-api";

const sortAddresses = (items: Address[]) =>
  [...items].sort(
    (a, b) =>
      Number(b.isDefault) - Number(a.isDefault) ||
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

export function AddressesManager() {
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  const [editing, setEditing] = useState<Address | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [removing, setRemoving] = useState<Address | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .listAddresses()
      .then((result) => {
        if (!cancelled) setAddresses(sortAddresses(result));
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const isFull = (addresses?.length ?? 0) >= MAX_ADDRESSES;

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  function openEdit(address: Address) {
    setEditing(address);
    setDialogOpen(true);
  }

  /** A new default address un-defaults the others, so reload the whole list. */
  async function reload() {
    setAddresses(sortAddresses(await usersApi.listAddresses()));
  }

  async function save(input: AddressInput) {
    if (editing) await usersApi.updateAddress(editing.id, input);
    else await usersApi.createAddress(input);
    await reload();
  }

  async function makeDefault(address: Address) {
    setBusyId(address.id);
    setError(null);
    try {
      await usersApi.updateAddress(address.id, { isDefault: true });
      await reload();
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    setBusyId(removing.id);
    setError(null);
    try {
      await usersApi.removeAddress(removing.id);
      setRemoving(null);
      await reload();
    } catch (err) {
      setError(authErrorMessage(err));
      setRemoving(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="grid gap-0.5">
          <h2 className="font-semibold">Adresses de livraison</h2>
          <p className="text-sm text-muted-foreground">
            Enregistrez jusqu’à {MAX_ADDRESSES} adresses pour commander plus vite.
          </p>
        </div>
        <Button size="sm" disabled={!addresses || isFull} onClick={openCreate}>
          <Plus />
          Ajouter une adresse
        </Button>
      </section>

      {error && <ErrorText>{error}</ErrorText>}

      <ul className="grid gap-3">
        {!addresses && !error && (
          <>
            <Skeleton className="h-24 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </>
        )}

        {addresses?.length === 0 && (
          <li className="flex flex-col items-center gap-2 rounded-xl border border-dashed p-8 text-center">
            <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MapPin className="size-5" />
            </span>
            <p className="text-sm font-semibold">Aucune adresse enregistrée</p>
            <p className="text-xs text-muted-foreground">
              Ajoutez votre première adresse de livraison.
            </p>
          </li>
        )}

        {addresses?.map((address) => {
          const isBusy = busyId === address.id;
          const place = [address.quartier, address.commune, address.city]
            .filter(Boolean)
            .join(", ");
          const phone = address.recipientPhone
            ? (parseDrcPhone(address.recipientPhone).international ?? address.recipientPhone)
            : null;

          return (
            <li key={address.id} className="flex items-start gap-4 rounded-xl border bg-card p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <MapPin className="size-5" />
              </span>

              <div className="grid min-w-0 flex-1 gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">{address.label}</p>
                  {address.isDefault && (
                    <Badge
                      variant="secondary"
                      className="border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    >
                      Par défaut
                    </Badge>
                  )}
                </div>
                <p className="text-sm">{address.line1}</p>
                <p className="text-xs text-muted-foreground">{place}</p>
                {address.landmark && (
                  <p className="text-xs text-muted-foreground">Repère : {address.landmark}</p>
                )}
                {address.latitude != null && address.longitude != null && (
                  <a
                    href={mapLink({ latitude: address.latitude, longitude: address.longitude })}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    <LocateFixed className="size-3" />
                    Position GPS · voir sur la carte
                  </a>
                )}
                {(address.recipientName || phone) && (
                  <p className="text-xs text-muted-foreground">
                    {[address.recipientName, phone].filter(Boolean).join(" · ")}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => openEdit(address)}
                  >
                    <Pencil />
                    Modifier
                  </Button>
                  {!address.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => void makeDefault(address)}
                    >
                      {isBusy ? <Spinner data-icon="inline-start" /> : <Star />}
                      Définir par défaut
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={() => setRemoving(address)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 />
                    Supprimer
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <AddressDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        address={editing}
        onSave={save}
      />

      <Dialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Supprimer cette adresse ?</DialogTitle>
            <DialogDescription>
              « {removing?.label} » sera supprimée de votre compte.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRemoving(null)} disabled={busyId !== null}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={() => void confirmRemove()}
              disabled={busyId !== null}
            >
              {busyId !== null && <Spinner data-icon="inline-start" />}
              Supprimer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
