import { createNotifications } from "swiftgoma-mp-notifications";
import { createRealtime } from "swiftgoma-mp-notifications/realtime";

import { auth } from "@/lib/auth";

// Web push is not handled by the package: no push provider is passed.
export const notifications = createNotifications({
  auth,
  onError: (error) => console.warn("[notifications] background refresh failed", error),
});

export const realtime = createRealtime({ auth, store: notifications.store });
