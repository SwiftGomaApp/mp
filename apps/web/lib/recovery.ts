const STORAGE_KEY = "swiftgoma:recovery";

export interface StoredRecovery {
  token: string;
  availableAt: string;
}

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());

export function subscribeRecovery(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function readRecoverySnapshot(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function parseRecovery(raw: string | null): StoredRecovery | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (
      value &&
      typeof value === "object" &&
      "token" in value &&
      "availableAt" in value &&
      typeof value.token === "string" &&
      typeof value.availableAt === "string"
    ) {
      return { token: value.token, availableAt: value.availableAt };
    }
  } catch {}
  return null;
}

export function saveRecovery(recovery: StoredRecovery) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recovery));
  } catch {}
  notify();
}

export function clearRecovery() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
  notify();
}
