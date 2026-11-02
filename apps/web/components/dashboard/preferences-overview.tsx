"use client";

import { useEffect, useState } from "react";
import { Download } from "lucide-react";
import { useTheme } from "next-themes";
import { useSession } from "swiftgoma-mp-auth/react";

import { DataExportDialog } from "@/components/dashboard/data-export-dialog";
import { ErrorText } from "@/components/security/recovery-codes-step";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { authErrorMessage } from "@/lib/auth-errors";
import { parseDrcPhone } from "@/lib/phone";
import {
  type NewOrderSound,
  type ReviewNameDisplay,
  type ThemePreference,
  type UserPreferences,
  usersApi,
} from "@/lib/users-api";
import { cn } from "cn";

const THEMES: { value: ThemePreference; label: string }[] = [
  { value: "LIGHT", label: "Clair" },
  { value: "DARK", label: "Sombre" },
  { value: "SYSTEM", label: "Système" },
];

const REVIEW_NAMES: { value: ReviewNameDisplay; label: string }[] = [
  { value: "FULL_NAME", label: "Nom complet" },
  { value: "FIRST_NAME_INITIAL", label: "Prénom et initiale" },
  { value: "ANONYMOUS", label: "Anonyme" },
];

const ORDER_SOUNDS: { value: NewOrderSound; label: string }[] = [
  { value: "default", label: "Par défaut" },
  { value: "bell", label: "Cloche" },
  { value: "chime", label: "Carillon" },
  { value: "alert", label: "Alerte" },
];

function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
  disabled,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onChange: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={value === option.value}
          size="sm"
          variant={value === option.value ? "default" : "outline"}
          disabled={disabled}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}

function Row({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-3 p-4">
      <div className="grid gap-0.5">
        <h3 className="text-sm font-medium">{title}</h3>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

export function PreferencesOverview() {
  const { user } = useSession();
  const { setTheme } = useTheme();
  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [momo, setMomo] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exportOpen, setExportOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    usersApi
      .getPreferences()
      .then((result) => {
        if (cancelled) return;
        setPreferences(result);
        setMomo(
          result.preferredMomoNumber
            ? (parseDrcPhone(result.preferredMomoNumber).local ?? result.preferredMomoNumber)
            : "",
        );
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save(patch: Partial<UserPreferences>) {
    if (!preferences || isSaving) return;
    const previous = preferences;
    setPreferences({ ...preferences, ...patch });
    setIsSaving(true);
    setError(null);
    try {
      setPreferences(await usersApi.updatePreferences(patch));
    } catch (err) {
      setPreferences(previous);
      setError(authErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }

  function changeTheme(value: ThemePreference) {
    setTheme(value.toLowerCase());
    void save({ theme: value });
  }

  const momoPhone = momo.trim() ? parseDrcPhone(momo) : null;
  const momoInvalid = momoPhone !== null && !momoPhone.valid;
  const momoChanged = (momoPhone?.e164 ?? null) !== (preferences?.preferredMomoNumber ?? null);
  const isBuyer = user?.role === "BUYER";
  const isSeller = user?.role === "SELLER";

  return (
    <div className="grid gap-6">
      <section className="grid gap-0.5">
        <h2 className="font-semibold">Préférences</h2>
        <p className="text-sm text-muted-foreground">
          Personnalisez votre expérience. Les changements sont enregistrés automatiquement.
        </p>
      </section>

      {error && <ErrorText>{error}</ErrorText>}

      {!preferences && !error && <Skeleton className="h-64 w-full rounded-xl" />}

      {preferences && (
        <section className="divide-y rounded-xl border bg-card">
          <Row title="Thème" description="Apparence de SwiftGoma sur cet appareil.">
            <Segmented
              label="Thème"
              options={THEMES}
              value={preferences.theme}
              onChange={changeTheme}
              disabled={isSaving}
            />
          </Row>

          <div className="flex items-center justify-between gap-4 p-4">
            <div className="grid gap-0.5">
              <h3 className="text-sm font-medium">Économiseur de données</h3>
              <p className="text-xs text-muted-foreground">
                Réduit la qualité des images pour consommer moins de data.
              </p>
            </div>
            <Switch
              checked={preferences.dataSaver}
              onCheckedChange={(checked) => void save({ dataSaver: checked === true })}
              disabled={isSaving}
              aria-label="Économiseur de données"
            />
          </div>

          {isBuyer && (
            <>
              <Row
                title="Numéro Mobile Money"
                description="Prérempli lors du paiement de vos commandes."
              >
                <div className="flex flex-wrap items-center gap-2">
                  <Input
                    type="tel"
                    inputMode="tel"
                    autoComplete="off"
                    placeholder="0990 000 000"
                    value={momo}
                    onChange={(event) => setMomo(event.target.value)}
                    disabled={isSaving}
                    aria-invalid={momoInvalid}
                    className={cn("h-9 max-w-56")}
                  />
                  <Button
                    size="sm"
                    disabled={isSaving || momoInvalid || !momoChanged}
                    onClick={() => void save({ preferredMomoNumber: momoPhone?.e164 ?? null })}
                  >
                    {isSaving && <Spinner data-icon="inline-start" />}
                    Enregistrer
                  </Button>
                </div>
                {momoInvalid && (
                  <p role="alert" className="text-xs text-destructive">
                    Numéro invalide. Seuls les numéros de la RDC sont acceptés.
                  </p>
                )}
              </Row>

              <Row
                title="Nom affiché sur mes avis"
                description="Comment votre nom apparaît quand vous notez un produit."
              >
                <Segmented
                  label="Nom affiché sur mes avis"
                  options={REVIEW_NAMES}
                  value={preferences.reviewNameDisplay}
                  onChange={(value) => void save({ reviewNameDisplay: value })}
                  disabled={isSaving}
                />
              </Row>
            </>
          )}

          {isSeller && (
            <Row
              title="Son des nouvelles commandes"
              description="Son joué quand une commande arrive."
            >
              <Segmented
                label="Son des nouvelles commandes"
                options={ORDER_SOUNDS}
                value={preferences.newOrderSound}
                onChange={(value) => void save({ newOrderSound: value })}
                disabled={isSaving}
              />
            </Row>
          )}
        </section>
      )}

      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="grid gap-0.5">
          <h2 className="font-semibold">Mes données</h2>
          <p className="text-sm text-muted-foreground">
            Téléchargez une copie des informations liées à votre compte.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setExportOpen(true)}>
          <Download />
          Télécharger mes données
        </Button>
      </section>

      <DataExportDialog open={exportOpen} onOpenChange={setExportOpen} />
    </div>
  );
}
