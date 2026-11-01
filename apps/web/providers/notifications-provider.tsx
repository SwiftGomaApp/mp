"use client";

import { NotificationsProvider as SwiftGomaNotificationsProvider } from "swiftgoma-mp-notifications/react";

import { notifications, realtime } from "@/lib/notifications";

/** Must stay inside `AuthProvider`, which starts the session. */
export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  return (
    <SwiftGomaNotificationsProvider notifications={notifications} realtime={realtime}>
      {children}
    </SwiftGomaNotificationsProvider>
  );
}
