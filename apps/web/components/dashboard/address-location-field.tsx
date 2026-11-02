"use client";

import { useState } from "react";
import { LocateFixed, MapPin, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

interface AddressLocationFieldProps {
  value: Coordinates | null;
  onChange: (value: Coordinates | null) => void;
  disabled?: boolean;
}

const GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 15_000,
  maximumAge: 60_000,
};

const roundCoordinate = (value: number) => Math.round(value * 1e6) / 1e6;

function geolocationMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Localisation refusée. Autorisez-la dans les réglages de votre navigateur, puis réessayez.";
    case error.POSITION_UNAVAILABLE:
      return "Votre position est introuvable pour le moment. Réessayez dans un instant.";
    case error.TIMEOUT:
      return "La localisation a pris trop de temps. Réessayez.";
    default:
      return "Impossible de récupérer votre position.";
  }
}

export const mapLink = ({ latitude, longitude }: Coordinates) =>
  `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=18/${latitude}/${longitude}`;

/** Fills the address coordinates from the browser's geolocation, only when the user asks. */
export function AddressLocationField({ value, onChange, disabled }: AddressLocationFieldProps) {
  const [isLocating, setIsLocating] = useState(false);
  const [accuracy, setAccuracy] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function locate() {
    if (isLocating) return;
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setError("Votre navigateur ne permet pas la localisation.");
      return;
    }
    setIsLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        onChange({
          latitude: roundCoordinate(coords.latitude),
          longitude: roundCoordinate(coords.longitude),
        });
        setAccuracy(Math.round(coords.accuracy));
        setIsLocating(false);
      },
      (geoError) => {
        setError(geolocationMessage(geoError));
        setIsLocating(false);
      },
      GEOLOCATION_OPTIONS,
    );
  }

  return (
    <div className="grid gap-2 rounded-xl border p-3.5">
      <div className="grid gap-0.5">
        <p className="text-sm font-medium">Position GPS (facultatif)</p>
        <p className="text-xs text-muted-foreground">
          Aide le livreur à vous trouver. Votre position n’est lue que lorsque vous cliquez sur le
          bouton.
        </p>
      </div>

      {value && (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <MapPin className="size-3.5 shrink-0 text-primary" />
          <a
            href={mapLink(value)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium underline-offset-4 hover:underline"
          >
            {value.latitude}, {value.longitude}
          </a>
          {accuracy !== null && <span className="text-muted-foreground">±{accuracy} m</span>}
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || isLocating}
          onClick={locate}
        >
          {isLocating ? <Spinner data-icon="inline-start" /> : <LocateFixed />}
          {value ? "Mettre à jour ma position" : "Utiliser ma position"}
        </Button>
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isLocating}
            onClick={() => {
              onChange(null);
              setAccuracy(null);
              setError(null);
            }}
          >
            <X />
            Retirer
          </Button>
        )}
      </div>

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
