"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Spinner } from "@/components/ui/spinner";
import { auth } from "@/lib/auth";

const SIGN_IN_PATH = "/auth/sign-in";
/** If the sign-in page never shows up, the screen must not stay forever. */
const SAFETY_TIMEOUT_MS = 8000;

// The screen lives in the root layout, outside the dashboard: signing out empties the session,
// which unmounts the dashboard, and the screen has to survive that until the sign-in page is up.
let active = false;
const listeners = new Set<() => void>();

function setActive(next: boolean) {
  active = next;
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => active;
const getServerSnapshot = () => false;

/** Signs the user out behind the full-screen "Déconnexion…" screen, then opens the sign-in page. */
export function useLogout() {
  const router = useRouter();
  const isLoggingOut = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  async function logout() {
    if (active) return;
    setActive(true);
    try {
      await auth.logout();
    } finally {
      router.replace(SIGN_IN_PATH);
      setTimeout(() => setActive(false), SAFETY_TIMEOUT_MS);
    }
  }

  /** Ends every session of the account. If the server refuses, the user stays where they are. */
  async function logoutAll() {
    if (active) return;
    setActive(true);
    try {
      await auth.logoutAll();
    } catch (error) {
      setActive(false);
      throw error;
    }
    router.replace(SIGN_IN_PATH);
    setTimeout(() => setActive(false), SAFETY_TIMEOUT_MS);
  }

  return { logout, logoutAll, isLoggingOut };
}

/** Mount once, in the root layout. */
export function LogoutScreen() {
  const pathname = usePathname();
  const isLoggingOut = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  // The sign-in page is up: the work is done.
  useEffect(() => {
    if (active && pathname.startsWith("/auth")) setActive(false);
  }, [pathname]);

  if (!isLoggingOut) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[2000] flex items-center justify-center gap-3 bg-background text-muted-foreground"
    >
      <Spinner className="size-5" />
      <p className="text-sm font-medium">Déconnexion…</p>
    </div>
  );
}
