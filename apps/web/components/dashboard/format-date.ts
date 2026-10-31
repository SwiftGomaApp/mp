const dateTime = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const relative = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
];

export const formatDateTime = (iso: string) => dateTime.format(new Date(iso));

/** "il y a 3 heures", "hier"… */
export function formatRelative(iso: string): string {
  const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return relative.format(Math.trunc(seconds / size), unit);
  }
  return "à l’instant";
}

/** "Goma, République démocratique du Congo", from a city and an ISO country code or a name. */
export function formatPlace(city: string | null, country: string | null): string | null {
  let countryName = country;
  if (country && /^[A-Za-z]{2}$/.test(country)) {
    try {
      countryName =
        new Intl.DisplayNames(["fr"], { type: "region" }).of(country.toUpperCase()) ?? country;
    } catch {
      countryName = country;
    }
  }
  return [city, countryName].filter(Boolean).join(", ") || null;
}
