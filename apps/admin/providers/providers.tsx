"use client";

import { AuthProvider } from "swiftgoma-mp-auth/react";

import { auth } from "@/lib/auth";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider
      auth={auth}
      onStartError={(error) => console.warn("[auth] could not start the session", error)}
    >
      {children}
    </AuthProvider>
  );
}
