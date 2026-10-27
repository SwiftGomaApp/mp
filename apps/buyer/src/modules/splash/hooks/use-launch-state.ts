import { useEffect, useState } from "react";

import { hasSeenOnboarding } from "../storage/onboarding-storage";

export type LaunchState = "loading" | "first" | "returning";

export function useLaunchState(): LaunchState {
  const [state, setState] = useState<LaunchState>("loading");

  useEffect(() => {
    let cancelled = false;

    hasSeenOnboarding().then((seen) => {
      if (!cancelled) setState(seen ? "returning" : "first");
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
