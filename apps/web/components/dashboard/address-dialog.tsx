"use client";

import { useState } from "react";

import {
  AddressLocationField,
  type Coordinates,
} from "@/components/dashboard/address-location-field";
import { ErrorText } from "@/components/security/recovery-codes-step";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { authErrorMessage } from "@/lib/auth-errors";
import { parseDrcPhone } from "@/lib/phone";
import { ADDRESS_LIMITS, type Address, type AddressInput } from "@/lib/users-api";

const DEFAULT_CITY = "Goma";

interface AddressDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The address being edited, or null to add a new one. */
  address: Address | null;
  onSave: (input: AddressInput) => Promise<void>;
}

const orNull = (value: string) => value.trim().replace(/\s+/g, " ") || null;

function AddressForm({
  address,
  onSave,
  onClose,
}: Pick<AddressDialogProps, "address" | "onSave"> & { onClose: () => void }) {
  const [label, setLabel] = useState(address?.label ?? "");
  const [recipientName, setRecipientName] = useState(address?.recipientName ?? "");
  const [recipientPhone, setRecipientPhone] = useState(
    address?.recipientPhone
      ? (parseDrcPhone(address.recipientPhone).local ?? address.recipientPhone)
      : "",
  );
  const [line1, setLine1] = useState(address?.line1 ?? "");
  const [quartier, setQuartier] = useState(address?.quartier ?? "");
  const [commune, setCommune] = useState(address?.commune ?? "");
  const [city, setCity] = useState(address?.city ?? DEFAULT_CITY);
  const [landmark, setLandmark] = useState(address?.landmark ?? "");
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);
  const [coordinates, setCoordinates] = useState<Coordinates | null>(
    address?.latitude != null && address.longitude != null
      ? { latitude: address.latitude, longitude: address.longitude }
      : null,
  );
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const phone = recipientPhone.trim() ? parseDrcPhone(recipientPhone) : null;
  const phoneInvalid = phone !== null && !phone.valid;
  const isValid =
    label.trim().length >= 1 &&
    line1.trim().length >= 3 &&
    city.trim().length >= 2 &&
    !phoneInvalid;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSaving || !isValid) return;
    setIsSaving(true);
    setError(null);
    try {
      await onSave({
        label: label.trim(),
        recipientName: orNull(recipientName),
        recipientPhone: phone?.e164 ?? null,
        line1: line1.trim(),
        quartier: orNull(quartier),
        commune: orNull(commune),
        city: city.trim(),
        landmark: orNull(landmark),
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        // The server refuses to un-default an address: only send it to turn it on.
        ...(isDefault && !address?.isDefault ? { isDefault: true } : {}),
      });
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
        <DialogTitle>{address ? "Modifier l’adresse" : "Ajouter une adresse"}</DialogTitle>
        <DialogDescription>
          Les livreurs utilisent cette adresse pour vous livrer vos commandes.
        </DialogDescription>
      </DialogHeader>

      <FieldGroup className="gap-4">
        <Field>
          <FieldLabel htmlFor="address-label">Nom de l’adresse</FieldLabel>
          <Input
            id="address-label"
            placeholder="Maison, Bureau…"
            value={label}
            maxLength={ADDRESS_LIMITS.label}
            onChange={(event) => setLabel(event.target.value)}
            disabled={isSaving}
            className="h-10"
            autoFocus
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="address-line1">Adresse</FieldLabel>
          <Input
            id="address-line1"
            placeholder="Avenue, numéro, rue…"
            value={line1}
            maxLength={ADDRESS_LIMITS.line1}
            onChange={(event) => setLine1(event.target.value)}
            disabled={isSaving}
            className="h-10"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="address-quartier">Quartier</FieldLabel>
            <Input
              id="address-quartier"
              value={quartier}
              maxLength={ADDRESS_LIMITS.quartier}
              onChange={(event) => setQuartier(event.target.value)}
              disabled={isSaving}
              className="h-10"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="address-commune">Commune</FieldLabel>
            <Input
              id="address-commune"
              value={commune}
              maxLength={ADDRESS_LIMITS.commune}
              onChange={(event) => setCommune(event.target.value)}
              disabled={isSaving}
              className="h-10"
            />
          </Field>
        </div>

        <Field>
          <FieldLabel htmlFor="address-city">Ville</FieldLabel>
          <Input
            id="address-city"
            value={city}
            maxLength={80}
            onChange={(event) => setCity(event.target.value)}
            disabled={isSaving}
            className="h-10"
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="address-landmark">Point de repère</FieldLabel>
          <Input
            id="address-landmark"
            placeholder="Près de l’église, en face du marché…"
            value={landmark}
            maxLength={ADDRESS_LIMITS.landmark}
            onChange={(event) => setLandmark(event.target.value)}
            disabled={isSaving}
            className="h-10"
          />
        </Field>

        <AddressLocationField value={coordinates} onChange={setCoordinates} disabled={isSaving} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="address-recipient">Destinataire (facultatif)</FieldLabel>
            <Input
              id="address-recipient"
              autoComplete="off"
              value={recipientName}
              maxLength={ADDRESS_LIMITS.recipientName}
              onChange={(event) => setRecipientName(event.target.value)}
              disabled={isSaving}
              className="h-10"
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="address-phone">Téléphone (facultatif)</FieldLabel>
            <Input
              id="address-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              placeholder="0990 000 000"
              value={recipientPhone}
              onChange={(event) => setRecipientPhone(event.target.value)}
              disabled={isSaving}
              aria-invalid={phoneInvalid}
              className="h-10"
            />
          </Field>
        </div>
        {phoneInvalid && (
          <p role="alert" className="-mt-2 text-xs text-destructive">
            Numéro invalide. Seuls les numéros de la RDC sont acceptés.
          </p>
        )}

        <label className="flex items-start gap-3 text-sm">
          <Checkbox
            checked={isDefault}
            onCheckedChange={(checked) => setIsDefault(checked === true)}
            disabled={isSaving || address?.isDefault === true}
            className="mt-0.5"
          />
          <span>
            Utiliser comme adresse par défaut
            {address?.isDefault && (
              <span className="block text-xs text-muted-foreground">
                Pour changer l’adresse par défaut, définissez-en une autre.
              </span>
            )}
          </span>
        </label>
      </FieldGroup>

      {error && <ErrorText>{error}</ErrorText>}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={isSaving}>
          Annuler
        </Button>
        <Button type="submit" disabled={isSaving || !isValid}>
          {isSaving && <Spinner data-icon="inline-start" />}
          Enregistrer
        </Button>
      </DialogFooter>
    </form>
  );
}

export function AddressDialog({ open, onOpenChange, address, onSave }: AddressDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-md">
        <AddressForm address={address} onSave={onSave} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
