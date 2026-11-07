import { useSyncExternalStore } from "react";

let active = false;
const listeners = new Set<() => void>();

/** The full-page verification screen is showing: the security popup must stay away. */
export function setVerificationScreenActive(next: boolean) {
  if (active === next) return;
  active = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const useVerificationScreenActive = () =>
  useSyncExternalStore(
    subscribe,
    () => active,
    () => false,
  );
