import type { SessionState } from "@swiftgoma/auth";

import { auth } from "./auth";

let starting: Promise<SessionState> | null = null;

export function startSession(): Promise<SessionState> {
  if (!starting) {
    if (__DEV__) auth.session.subscribe((state) => console.log("[session]", state));

    starting = auth.session.start().catch((error: unknown) => {
      starting = null;
      throw error;
    });
  }
  return starting;
}
