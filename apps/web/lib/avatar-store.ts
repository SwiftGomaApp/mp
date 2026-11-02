import { useSyncExternalStore } from "react";

import { usersApi } from "@/lib/users-api";

/** The signed-in user's photo, shared by the sidebar and the profile page. */
interface AvatarState {
  userId: string;
  url: string | null;
}

let state: AvatarState | null = null;
let loadingFor: string | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
const getSnapshot = () => state;
const getServerSnapshot = () => null;

export function setAvatarUrl(userId: string, url: string | null) {
  state = { userId, url };
  listeners.forEach((listener) => listener());
}

/** Fetches the photo once per user; later calls are no-ops. */
export async function loadAvatar(userId: string) {
  if (state?.userId === userId || loadingFor === userId) return;
  loadingFor = userId;
  try {
    const profile = await usersApi.getProfile();
    setAvatarUrl(userId, profile.avatarUrl);
  } catch {
    // The initials stay as the fallback.
  } finally {
    loadingFor = null;
  }
}

/** The photo URL, `null` when there is none, `undefined` while it is not loaded yet. */
export function useAvatarUrl(userId: string | undefined): string | null | undefined {
  const current = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return userId && current?.userId === userId ? current.url : undefined;
}
