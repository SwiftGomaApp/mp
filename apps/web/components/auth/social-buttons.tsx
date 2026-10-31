"use client";

import { Fingerprint } from "lucide-react";

import { Button } from "@/components/ui/button";
import { auth } from "@/lib/auth";

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M16.37 12.63c-.03-2.74 2.24-4.06 2.34-4.12-1.27-1.86-3.25-2.12-3.96-2.15-1.69-.17-3.29.99-4.14.99-.86 0-2.17-.97-3.57-.94-1.84.03-3.53 1.07-4.48 2.71-1.91 3.31-.49 8.22 1.37 10.9.91 1.31 2 2.78 3.42 2.73 1.37-.05 1.89-.89 3.55-.89 1.65 0 2.12.89 3.57.86 1.47-.03 2.41-1.34 3.31-2.66 1.04-1.52 1.47-3 1.5-3.07-.03-.01-2.88-1.1-2.91-4.36ZM13.65 4.6c.75-.91 1.26-2.18 1.12-3.44-1.08.04-2.39.72-3.17 1.63-.7.81-1.31 2.09-1.15 3.33 1.21.09 2.45-.62 3.2-1.52Z" />
    </svg>
  );
}

interface SocialButtonsProps {
  verb: string;
  disabled?: boolean;
  withPasskey?: boolean;
  onGoogle: () => void;
  onApple?: () => void;
  onPasskey?: () => void;
}

export function SocialButtons({
  verb,
  disabled,
  withPasskey,
  onGoogle,
  onApple,
  onPasskey,
}: SocialButtonsProps) {
  return (
    <div className="grid w-full gap-3">
      <Button
        variant="secondary"
        size="lg"
        type="button"
        disabled={disabled || !auth.socials.enabled.google}
        onClick={onGoogle}
      >
        <GoogleIcon />
        {verb} avec Google
      </Button>
      {auth.socials.enabled.apple && (
        <Button variant="secondary" size="lg" type="button" disabled={disabled} onClick={onApple}>
          <AppleIcon />
          {verb} avec Apple
        </Button>
      )}
      {withPasskey && (
        <Button variant="secondary" size="lg" type="button" disabled={disabled} onClick={onPasskey}>
          <Fingerprint />
          {verb} avec une clé d’accès
        </Button>
      )}
    </div>
  );
}
