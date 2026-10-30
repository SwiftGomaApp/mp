"use client";

import { useEffect } from "react";
import { useAuth } from "swiftgoma-mp-auth/react";

export function RestoreSession() {
  const auth = useAuth();

  useEffect(() => {
    auth.me().catch(() => undefined);
  }, [auth]);

  return null;
}
