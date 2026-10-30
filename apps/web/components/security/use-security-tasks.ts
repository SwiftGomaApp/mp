"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "swiftgoma-mp-auth/react";

import { fetchSecurityTasks, type SecurityTask } from "@/lib/security";

interface Loaded {
  userId: string;
  tasks: SecurityTask[];
}

/** Checks the account's security once the user is signed in. `tasks` is null until it is known. */
export function useSecurityTasks() {
  const { status, user } = useSession();
  const userId = status === "authenticated" ? (user?.id ?? null) : null;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    fetchSecurityTasks()
      .then((tasks) => {
        if (!cancelled) setLoaded({ userId, tasks });
      })
      .catch(() => {
        // The prompt is a convenience: if the check fails, nothing is shown.
      });

    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const refresh = useCallback(() => setReloadKey((key) => key + 1), []);
  const tasks = loaded && loaded.userId === userId ? loaded.tasks : null;

  return { userId, tasks, refresh };
}
