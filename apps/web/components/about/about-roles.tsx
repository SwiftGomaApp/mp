"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Bike, ShoppingBag, Store } from "lucide-react";

import { cn } from "@/lib/utils";

const ROLES = [
  {
    id: "buyer",
    icon: ShoppingBag,
    title: "Acheteurs",
    summary: "Commandez auprès de boutiques de la ville.",
    headline: "Achetez sans craindre de payer dans le vide.",
    steps: [
      "Choisissez une boutique de Goma et passez commande.",
      "Votre paiement est mis de côté jusqu’à la remise.",
      "Scannez le code QR quand le colis est entre vos mains.",
    ],
    href: "/shops",
    cta: "Découvrir les boutiques",
  },
  {
    id: "seller",
    icon: Store,
    title: "Vendeurs",
    summary: "Ouvrez votre boutique en ligne.",
    headline: "Vendez en ligne, encaissez en toute sécurité.",
    steps: [
      "Ouvrez votre boutique et ajoutez vos produits.",
      "Acceptez la commande, préparez le colis.",
      "Retirez vos gains par Mobile Money.",
    ],
    href: "/sell",
    cta: "Vendre sur SwiftGoma",
  },
  {
    id: "rider",
    icon: Bike,
    title: "Livreurs",
    summary: "Livrez quand vous voulez.",
    headline: "Choisissez vos courses, soyez payé pour chacune.",
    steps: [
      "Liez-vous aux boutiques avec lesquelles vous voulez travailler.",
      "Acceptez les courses qui vous conviennent.",
      "Remettez le colis, faites scanner le code QR, recevez 100 % du montant convenu.",
    ],
    href: "/deliver",
    cta: "Devenir livreur",
  },
] as const;

const pad = (value: number) => String(value).padStart(2, "0");

/** One role at a time: pick who you are, see what SwiftGoma does for you. */
export function AboutRoles() {
  const [activeId, setActiveId] = useState<(typeof ROLES)[number]["id"]>("buyer");
  const active = ROLES.find((role) => role.id === activeId) ?? ROLES[0];

  return (
    <div className="mt-12 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)] lg:gap-10">
      <div
        role="tablist"
        aria-label="Votre rôle"
        className="grid grid-cols-3 gap-2 lg:grid-cols-1 lg:content-start"
      >
        {ROLES.map(({ id, icon: Icon, title, summary }) => {
          const selected = id === activeId;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              id={`role-tab-${id}`}
              aria-selected={selected}
              aria-controls="role-panel"
              onClick={() => setActiveId(id)}
              className={cn(
                "group relative flex cursor-pointer flex-col items-center gap-2 overflow-hidden rounded-2xl border p-3 text-center outline-none transition-all duration-300 focus-visible:ring-3 focus-visible:ring-ring/50 lg:flex-row lg:gap-4 lg:p-5 lg:text-left",
                selected
                  ? "border-foreground/30 bg-card shadow-sm"
                  : "border-transparent text-muted-foreground hover:bg-card/60 hover:text-foreground",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "absolute inset-y-0 left-0 hidden w-1 origin-top bg-primary transition-transform duration-500 lg:block",
                  selected ? "scale-y-100" : "scale-y-0",
                )}
              />
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-full transition-colors duration-300",
                  selected
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted group-hover:bg-muted/70",
                )}
              >
                <Icon className="size-5" />
              </span>
              <span className="grid leading-tight">
                <span className={cn("text-sm font-semibold", selected && "text-foreground")}>
                  {title}
                </span>
                <span className="mt-1 hidden text-xs lg:block">{summary}</span>
              </span>
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id="role-panel"
        aria-labelledby={`role-tab-${active.id}`}
        className="relative overflow-hidden rounded-2xl border bg-card p-6 sm:p-10"
      >
        <span
          aria-hidden
          className="pointer-events-none absolute -top-6 right-4 text-[9rem] leading-none font-bold text-foreground/[0.04] select-none sm:text-[12rem]"
        >
          {pad(ROLES.findIndex((role) => role.id === active.id) + 1)}
        </span>

        <div
          key={active.id}
          className="relative animate-in duration-500 fade-in slide-in-from-bottom-2 motion-reduce:animate-none"
        >
          <h3 className="max-w-md text-2xl font-bold tracking-tight text-balance sm:text-3xl">
            {active.headline}
          </h3>

          <ol className="mt-8 grid gap-0">
            {active.steps.map((step, index) => (
              <li
                key={step}
                style={{ animationDelay: `${index * 120}ms` }}
                className="group/step relative flex animate-in items-start gap-4 pb-6 duration-700 fade-in slide-in-from-left-3 fill-mode-backwards last:pb-0 motion-reduce:animate-none"
              >
                {index < active.steps.length - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-8 bottom-0 left-[0.95rem] w-px bg-border"
                  />
                )}
                <span className="relative flex size-8 shrink-0 items-center justify-center rounded-full border bg-background text-xs font-semibold tabular-nums transition-colors group-hover/step:border-primary group-hover/step:bg-primary group-hover/step:text-primary-foreground">
                  {index + 1}
                </span>
                <p className="pt-1 text-sm leading-6 text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>

          <Link
            href={active.href}
            className="group mt-10 inline-flex h-11 items-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground outline-none transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            {active.cta}
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
          </Link>
        </div>
      </div>
    </div>
  );
}
