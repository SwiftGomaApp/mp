import { createContext, createElement, useContext, useEffect, useSyncExternalStore } from "react";
import type { ReactElement, ReactNode } from "react";
import type { Auth } from "../core/create-auth";
import type { SessionState } from "../core/session-store";
import type { AuthUser } from "../core/types";

const AuthContext = createContext<Auth | null>(null);

export interface AuthProviderProps {
  /** The object from `createAuth`. Create it once, outside any component. */
  auth: Auth;
  children?: ReactNode;
  /** Called when the saved session cannot be read, for example when secure storage is locked. */
  onStartError?: (error: unknown) => void;
}

/**
 * Starts the session when the app mounts and stops it when the app unmounts.
 * In Next.js, use it from a client component.
 */
export function AuthProvider({ auth, children, onStartError }: AuthProviderProps): ReactElement {
  useEffect(() => {
    auth.start().catch((error: unknown) => onStartError?.(error));
    return () => auth.stop();
  }, [auth, onStartError]);

  return createElement(AuthContext.Provider, { value: auth }, children);
}

/** The `Auth` object given to `AuthProvider`. */
export function useAuth(): Auth {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error("swiftgoma-mp-auth: useAuth must be used inside <AuthProvider>");
  return auth;
}

/** The session state: `status`, `user` and when the access token expires. Re-renders on change. */
export function useSession(): SessionState<AuthUser> {
  const auth = useAuth();
  return useSyncExternalStore(auth.session.subscribe, auth.session.getState, auth.session.getState);
}

/** The signed-in user, or `null` when nobody is signed in or the session is not checked yet. */
export function useCurrentUser(): AuthUser | null {
  return useSession().user;
}
