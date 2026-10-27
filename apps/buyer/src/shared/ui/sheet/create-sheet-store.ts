import { useSyncExternalStore } from "react";

export function createSheetStore() {
  let isOpen = false;
  const listeners = new Set<() => void>();

  function set(value: boolean) {
    if (isOpen === value) return;
    isOpen = value;
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function useSheet() {
    const open = useSyncExternalStore(
      subscribe,
      () => isOpen,
      () => false,
    );
    return [open, set] as const;
  }

  return {
    open: () => set(true),
    close: () => set(false),
    useSheet,
  };
}
