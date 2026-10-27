const TIMEOUT_MS = 5_000;

export function getApiOrigin(): string | null {
  const raw = process.env.EXPO_PUBLIC_API_URL;
  return raw ? raw.replace(/\/+$/, "") : null;
}

export async function checkServer(): Promise<boolean> {
  const origin = getApiOrigin();
  if (!origin) return true;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(`${origin}/api/v1/health`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (!response.ok) return false;

    const data = (await response.json()) as { status?: string };
    return data.status === "ok";
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
