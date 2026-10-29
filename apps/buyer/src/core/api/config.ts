export function getApiOrigin(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL;
  return raw ? raw.replace(/\/+$/, "") : null;
}

export function requireApiOrigin(): string {
  const origin = getApiOrigin();
  if (!origin) {
    throw new Error(
      "EXPO_PUBLIC_API_URL est manquante : copiez .env.example vers .env et indiquez l'adresse du serveur.",
    );
  }
  return origin;
}
