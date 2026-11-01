"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [subscribed, setSubscribed] = useState(false);

  const isValid = EMAIL_PATTERN.test(email.trim());

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || !isValid) return;
    setIsLoading(true);
    // TODO: send the subscription once the endpoint exists.
    setTimeout(() => {
      setIsLoading(false);
      setSubscribed(true);
    }, 700);
  }

  if (subscribed) {
    return (
      <p role="status" className="flex items-center gap-2 text-sm">
        <CircleCheck className="size-4 shrink-0" />
        Merci ! Vous êtes inscrit à la newsletter.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-2">
      <div className="flex gap-2">
        <Input
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Votre adresse e-mail"
          aria-label="Adresse e-mail pour la newsletter"
          autoComplete="email"
          disabled={isLoading}
          className="h-9"
        />
        <Button type="submit" disabled={isLoading || !isValid}>
          {isLoading && <Spinner data-icon="inline-start" />}
          S’inscrire
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Nouvelles boutiques, offres et lancement. Désinscription à tout moment.
      </p>
    </form>
  );
}
