"use client";

import { AuthProvider as SwiftGomaAuthProvider } from "swiftgoma-mp-auth/react";

import { auth } from "@/lib/auth";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SwiftGomaAuthProvider
      auth={auth}
      onStartError={(error) => console.warn("[auth] could not start the session", error)}
    >
      {children}
    </SwiftGomaAuthProvider>
  );
}
