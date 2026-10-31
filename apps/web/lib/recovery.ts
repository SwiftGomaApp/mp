/**
 * An account recovery has a waiting period, so the token must survive a refresh and a closed tab.
 * It is kept in localStorage until the recovery is completed, cancelled or found invalid.
 */
const STORAGE_KEY = "swiftgoma:recovery";

export interface StoredRecovery {
  token: string;
  /** ISO date: the new contact can only be set from then on. */
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

/** The raw stored value, so it can be used as a stable snapshot. */
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
  } catch {
    // A corrupted value is the same as no recovery.
  }
  return null;
}

export function saveRecovery(recovery: StoredRecovery) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(recovery));
  } catch {
    // Without storage the flow still works until the page is closed.
  }
  notify();
}

export function clearRecovery() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nothing to clear.
  }
  notify();
}
