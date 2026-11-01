"use client";

import { useState } from "react";
import {
  Bike,
  CircleCheck,
  MessageCircle,
  Package,
  Store,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const TOPICS: { id: string; label: string; icon: LucideIcon; needsOrder?: boolean }[] = [
  { id: "account", label: "Mon compte", icon: UserRound },
  { id: "order", label: "Une commande", icon: Package, needsOrder: true },
  { id: "payment", label: "Un paiement", icon: Wallet, needsOrder: true },
  { id: "delivery", label: "Une livraison", icon: Bike, needsOrder: true },
  { id: "partner", label: "Vendre ou livrer", icon: Store },
  { id: "other", label: "Autre chose", icon: MessageCircle },
];

const MIN_MESSAGE_LENGTH = 10;
const MAX_MESSAGE_LENGTH = 1000;

export function SupportForm() {
  const [topicId, setTopicId] = useState(TOPICS[0].id);
  const [contact, setContact] = useState("");
  const [reference, setReference] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const topic = TOPICS.find((item) => item.id === topicId) ?? TOPICS[0];
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
      <div className="flex min-h-80 animate-in flex-col items-start justify-center gap-5 rounded-2xl border bg-card p-8 duration-500 fade-in zoom-in-95 motion-reduce:animate-none sm:p-10">
        <span className="flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CircleCheck className="size-7" />
        </span>
        <div className="grid gap-1">
          <h3 className="text-xl font-semibold">Message envoyé</h3>
          <p className="text-sm leading-6 text-muted-foreground">
            Merci. Notre équipe vous répondra par le contact que vous avez indiqué. Inutile de
            renvoyer le même message.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setSent(false);
            setMessage("");
            setReference("");
          }}
        >
          Écrire un autre message
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 rounded-2xl border bg-card p-6 sm:p-8">
      <fieldset className="grid gap-3">
        <legend className="text-sm font-medium">De quoi s’agit-il ?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TOPICS.map(({ id, label, icon: Icon }) => {
            const selected = id === topicId;
            return (
              <button
                key={id}
                type="button"
                aria-pressed={selected}
                disabled={isLoading}
                onClick={() => setTopicId(id)}
                className={cn(
                  "flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-3 text-left text-sm transition-all duration-200 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected
                    ? "border-foreground/40 bg-muted font-medium"
                    : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex size-8 shrink-0 items-center justify-center rounded-full transition-colors duration-200",
                    selected ? "bg-primary text-primary-foreground" : "bg-muted",
                  )}
                >
                  <Icon className="size-4" />
                </span>
                {label}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div
        className={cn(
          "grid transition-all duration-300 ease-out motion-reduce:transition-none",
          topic.needsOrder ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        )}
      >
        <div className="overflow-hidden">
          <Field className="gap-1.5 p-px">
            <FieldLabel htmlFor="contact-reference">
              Numéro de commande{" "}
              <span className="font-normal text-muted-foreground">(facultatif)</span>
            </FieldLabel>
            <Input
              id="contact-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
              disabled={isLoading}
              tabIndex={topic.needsOrder ? 0 : -1}
              placeholder="Visible dans le détail de votre commande"
            />
          </Field>
        </div>
      </div>

      <Field className="gap-1.5">
        <FieldLabel htmlFor="contact-way">Comment vous répondre ?</FieldLabel>
        <Input
          id="contact-way"
          value={contact}
          onChange={(event) => setContact(event.target.value)}
          disabled={isLoading}
          autoComplete="email"
          placeholder="Votre e-mail ou numéro de téléphone"
          required
        />
      </Field>

      <Field className="gap-1.5">
        <FieldLabel htmlFor="contact-message">Votre message</FieldLabel>
        <Textarea
          id="contact-message"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MAX_MESSAGE_LENGTH}
          rows={6}
          placeholder="Décrivez ce qui s’est passé, avec le plus de détails possible"
          disabled={isLoading}
          required
        />
        <p className="text-right text-xs text-muted-foreground tabular-nums">
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
