"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

// next-themes (0.4.6, latest) renders an inline <script> that React 19 warns about on the client.
// The script already ran from the server HTML before hydration, so the warning is harmless.
// Drop only that message until next-themes ships a fix.
if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
  const consoleError = console.error;
  console.error = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].includes("Encountered a script tag")) return;
    consoleError(...args);
  };
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}
