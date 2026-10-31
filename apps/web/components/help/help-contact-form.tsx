"use client";

import { useState } from "react";
import { CircleCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";

const TOPICS = [
  "Mon compte",
  "Une commande",
  "Un paiement",
  "Une livraison",
  "Vendre sur SwiftGoma",
  "Devenir livreur",
  "Autre chose",
];

const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 1000;

/** UI only for now: submitting shows the confirmation without sending anything. */
export function HelpContactForm() {
  const [topic, setTopic] = useState(TOPICS[0]);
  const [contact, setContact] = useState("");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const trimmed = message.trim();
  const isValid = contact.trim().length > 3 && trimmed.length >= MIN_MESSAGE_LENGTH;

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isLoading || !isValid) return;
    setIsLoading(true);
    // TODO: send the request to the Support once the endpoint exists.
    setTimeout(() => {
      setIsLoading(false);
      setSent(true);
    }, 700);
  }

  if (sent) {
    return (
      <div className="flex flex-col items-start gap-4 border-y py-12">
        <span className="text-foreground">
          <CircleCheck className="size-7" />
        </span>
        <div className="grid gap-1">
          <h3 className="text-lg font-semibold">Message envoyé</h3>
          <p className="text-sm text-muted-foreground">
            Merci, notre équipe vous répondra par le contact que vous avez indiqué.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setSent(false);
            setMessage("");
            setReference("");
          }}
        >
          Envoyer un autre message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid content-start gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field className="gap-1.5">
          <FieldLabel htmlFor="help-topic">Sujet</FieldLabel>
          <select
            id="help-topic"
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            disabled={isLoading}
            className="h-9 w-full rounded-md border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {TOPICS.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </Field>
        <Field className="gap-1.5">
          <FieldLabel htmlFor="help-contact">Votre e-mail ou téléphone</FieldLabel>
          <Input
            id="help-contact"
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            disabled={isLoading}
            autoComplete="email"
            required
          />
        </Field>
      </div>

      <Field className="gap-1.5">
        <FieldLabel htmlFor="help-reference">
          Numéro de commande <span className="font-normal text-muted-foreground">(facultatif)</span>
        </FieldLabel>
        <Input
          id="help-reference"
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          disabled={isLoading}
        />
      </Field>

      <Field className="gap-1.5">
        <FieldLabel htmlFor="help-message">Votre message</FieldLabel>
        <Textarea
          id="help-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={6}
          placeholder="Décrivez votre problème le plus précisément possible"
          disabled={isLoading}
          required
        />
        <p className="text-right text-xs text-muted-foreground">
          {trimmed.length}/{MAX_MESSAGE_LENGTH}
        </p>
      </Field>

      <Button
        type="submit"
        size="lg"
        variant={isValid ? "default" : "secondary"}
        disabled={isLoading || !isValid}
      >
        {isLoading && <Spinner data-icon="inline-start" />}
        {isLoading ? "Envoi…" : "Envoyer au Support"}
      </Button>
    </form>
  );
}
