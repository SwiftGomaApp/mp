import { getApiOrigin } from "../api/config";

const TIMEOUT_MS = 5_000;

export async function checkServer(): Promise<boolean> {
  const origin = getApiOrigin();
  if (!origin) return true;

  const url = `${origin}/api/v1/health`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    if (__DEV__) console.log("[health]", url, "->", response.status);
    if (!response.ok) return false;

    const data = (await response.json()) as { status?: string };
    if (__DEV__) console.log("[health] answer:", data);
    return data.status === "ok";
  } catch (error) {
    if (__DEV__) console.log("[health] failed:", url, String(error));
    return false;
  } finally {
    clearTimeout(timer);
  }
}
