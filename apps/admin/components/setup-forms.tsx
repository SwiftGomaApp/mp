"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

import { Button, Card, ErrorBanner, Field, Input, Notice } from "@/components/ui";
import { auth, staff } from "@/lib/auth";

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
    <Card className="w-full max-w-sm">
      <Image src="/logo-icon.png" alt="SwiftGoma" width={40} height={40} className="mb-3" />
      <h1 className="mb-4 text-xl font-bold tracking-tight">{title}</h1>
      <div className="grid gap-4">{children}</div>
      <Link href="/login" className="mt-4 block text-center text-xs text-muted-foreground hover:underline">
        Retour à la connexion
      </Link>
    </Card>
    </div>
  );
}

/** Finishes a staff account from the e-mailed link (`?token=`): sets the password. */
export function StaffSetupForm() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await staff.setup({ token, newPassword: password });
      setDone(result.message);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <Shell title="Activer mon compte">
        <ErrorBanner error={new Error("Lien d'activation invalide : jeton manquant.")} />
      </Shell>
    );
  }

  return (
    <Shell title="Activer mon compte">
      {done ? (
        <Notice tone="good">{done}</Notice>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <Field label="Nouveau mot de passe">
            <Input
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </Field>
          <ErrorBanner error={error} />
          <Button type="submit" loading={busy}>
            Définir le mot de passe
          </Button>
        </form>
      )}
    </Shell>
  );
}

/** Forgotten password: sends a code, then sets the new password with it. */
export function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [sent, setSent] = useState(false);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (!sent) {
        await auth.password.forgot({ email: email.trim() });
        setSent(true);
      } else {
        await auth.password.reset({ email: email.trim(), code, newPassword: password });
        setDone(true);
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Shell title="Mot de passe oublié">
      {done ? (
        <Notice tone="good">Mot de passe modifié. Vous pouvez vous connecter.</Notice>
      ) : (
        <form onSubmit={submit} className="grid gap-4">
          <Field label="E-mail">
            <Input
              type="email"
              required
              disabled={sent}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
          {sent && (
            <>
              <Notice>Si ce compte existe, un code vient d&apos;être envoyé.</Notice>
              <Field label="Code reçu">
                <Input required inputMode="numeric" value={code} onChange={(e) => setCode(e.target.value)} />
              </Field>
              <Field label="Nouveau mot de passe">
                <Input
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </Field>
            </>
          )}
          <ErrorBanner error={error} />
          <Button type="submit" loading={busy}>
            {sent ? "Réinitialiser" : "Envoyer le code"}
          </Button>
        </form>
      )}
    </Shell>
  );
}
