import type { SessionState } from "@swiftgoma/auth";
import { useSyncExternalStore } from "react";

import { auth } from "./auth";

const subscribe = (onChange: () => void) => auth.session.subscribe(onChange);
const getSnapshot = () => auth.session.state;

export function useSession(): SessionState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
