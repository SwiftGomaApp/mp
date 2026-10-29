import type { CurrentUser } from "@swiftgoma/auth";
import { useEffect, useState } from "react";

import { auth } from "./auth";
import { useSession } from "./use-session";

type CurrentUserState = {
  user: CurrentUser | null;
  loading: boolean;
};

/** The signed-in user's profile, loaded from the server. `user` is null when signed out. */
export function useCurrentUser(): CurrentUserState {
  const session = useSession();
  const signedIn = session.status === "authenticated";
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!signedIn) return;

    let cancelled = false;
    auth
      .me()
      .then((me) => {
        if (cancelled) return;
        setUser(me);
        setFailed(false);
      })
      .catch(() => {
        // A real sign-out is handled by the session; here we only keep the screen usable.
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [signedIn]);

  return {
    user: signedIn ? user : null,
    loading: signedIn && !user && !failed,
  };
}
