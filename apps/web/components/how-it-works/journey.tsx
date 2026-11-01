"use client";

import { useEffect, useState } from "react";
import {
  Bike,
  Check,
  FileSignature,
  FileText,
  Package,
  QrCode,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Store,
  Timer,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

interface Step {
  icon: LucideIcon;
  title: string;
  text: string;
  badge: string;
  chips: string[];
}

const ROLES: { id: string; label: string; icon: LucideIcon; steps: Step[] }[] = [
  {
    id: "buyer",
    label: "Acheteur",
    icon: ShoppingBag,
    steps: [
      {
        icon: Search,
        title: "Parcourez sans compte",
        text: "Les boutiques sont triées par distance. Vous n’avez besoin d’un compte qu’au moment de commander, et aucune vérification d’identité n’est demandée.",
        badge: "Catalogue",
        chips: ["Sans compte", "Triées par distance"],
      },
      {
        icon: ShoppingCart,
        title: "Remplissez votre panier",
        text: "Un panier par boutique, donc une commande par boutique. Le prix affiché est le prix que vous payez : la livraison est comprise.",
        badge: "Panier",
        chips: ["Livraison incluse", "USD ou CDF", "Code promo"],
      },
      {
        icon: ShieldCheck,
        title: "Payez par Mobile Money",
        text: "Vous confirmez sur votre téléphone avec votre code secret. Votre argent est retenu en sécurité, personne ne le touche encore.",
        badge: "Paiement protégé",
        chips: ["5 min pour confirmer", "Argent retenu"],
      },
      {
        icon: Timer,
        title: "Le vendeur répond",
        text: "Il a 15 minutes pour accepter ou refuser. S’il refuse ou ne répond pas, vous êtes remboursé automatiquement.",
        badge: "En attente du vendeur",
        chips: ["15 min", "Remboursement automatique"],
      },
      {
        icon: Bike,
        title: "Suivez votre commande",
        text: "En préparation, prête, en livraison : vous êtes prévenu à chaque étape et vous voyez le livreur avancer sur la carte.",
        badge: "En livraison",
        chips: ["Temps réel", "Notifications", "Livraison ou retrait"],
      },
      {
        icon: QrCode,
        title: "Montrez le code QR à la réception",
        text: "Il est à usage unique et seul le livreur ou le vendeur de la commande peut le scanner. Montrez-le une fois le colis en main, pas avant.",
        badge: "Remise confirmée",
        chips: ["Usage unique", "Code à 6 chiffres si le scan échoue"],
      },
    ],
  },
  {
    id: "seller",
    label: "Vendeur",
    icon: Store,
    steps: [
      {
        icon: FileSignature,
        title: "Acceptez le contrat",
        text: "Dans l’application, sans papier : vous cochez « J’accepte » et vous saisissez un code reçu sur votre téléphone. Vous pouvez en télécharger une copie en PDF.",
        badge: "Contrat",
        chips: ["Sans papier", "Copie PDF"],
      },
      {
        icon: FileText,
        title: "Envoyez votre dossier",
        text: "Pièce d’identité et selfie, registre de commerce, numéro d’impôt, photos de la boutique, numéro Mobile Money au même nom. Le Support vérifie, un Admin décide.",
        badge: "Vérification",
        chips: ["Support puis Admin", "3 essais"],
      },
      {
        icon: Store,
        title: "Votre boutique devient visible",
        text: "Il faut un dossier approuvé, le contrat accepté, un contact de récupération et un numéro de versement vérifiés. L’application vous montre ce qu’il reste à faire.",
        badge: "Boutique active",
        chips: ["Dossier approuvé", "Contact vérifié", "Numéro de versement"],
      },
      {
        icon: Timer,
        title: "Acceptez la commande",
        text: "Vous êtes prévenu dès qu’elle est payée. 15 minutes pour répondre, avec un rappel à 5 minutes. Sans réponse, l’acheteur est remboursé.",
        badge: "Nouvelle commande",
        chips: ["15 min", "Rappel à 5 min"],
      },
      {
        icon: Package,
        title: "Préparez et remettez",
        text: "Marquez la commande « prête », puis choisissez un livreur lié à votre boutique et le montant convenu avec lui. Pour un retrait, vous scannez vous-même le QR.",
        badge: "Prête à remettre",
        chips: ["Livreur de votre choix", "Montant convenu"],
      },
      {
        icon: Wallet,
        title: "Encaissez",
        text: "Après le scan, la commission va à SwiftGoma, le montant convenu au livreur et le reste dans votre portefeuille. Il reste en attente 24 heures, puis vous le retirez sur Mobile Money.",
        badge: "Paiement",
        chips: ["Deux soldes USD / CDF", "24 h en attente"],
      },
    ],
  },
  {
    id: "rider",
    label: "Livreur",
    icon: Bike,
    steps: [
      {
        icon: FileText,
        title: "Envoyez votre dossier",
        text: "Pièce d’identité et selfie, permis, photos du véhicule et de la plaque. Le Support vérifie et un Admin décide, avec 3 essais.",
        badge: "Vérification",
        chips: ["Support puis Admin", "3 essais"],
      },
      {
        icon: Store,
        title: "Liez-vous aux boutiques",
        text: "Vous envoyez une demande de liaison. Elle n’est active qu’une fois acceptée par la boutique, qui peut vous retirer à tout moment.",
        badge: "Boutiques",
        chips: ["Vous choisissez", "Accord de la boutique"],
      },
      {
        icon: Bike,
        title: "Acceptez une course",
        text: "Vous recevez une alerte. La boutique propose un montant convenu et vous le confirmez avant de partir.",
        badge: "Nouvelle course",
        chips: ["Alerte immédiate", "Montant confirmé avant le départ"],
      },
      {
        icon: QrCode,
        title: "Remettez le colis",
        text: "Le client montre son code QR et vous le scannez. S’il est absent, attendez 10 minutes et appelez-le, puis signalez « acheteur absent » : la course vous est payée.",
        badge: "Remise confirmée",
        chips: ["10 min d’attente", "Payé même si absent"],
      },
      {
        icon: Wallet,
        title: "Recevez votre paiement",
        text: "Vous touchez 100 % du montant convenu dans votre portefeuille, en attente 24 heures, puis retirable sur Mobile Money.",
        badge: "Paiement",
        chips: ["100 % du montant convenu", "24 h en attente"],
      },
    ],
  },
];

const STEP_MS = 5500;

const pad = (value: number) => String(value).padStart(2, "0");

/** A role picker, then its steps that play one after the other. */
export function Journey() {
  const [roleId, setRoleId] = useState(ROLES[0].id);
  const [step, setStep] = useState(0);
  const [paused, setPaused] = useState(false);

  const role = ROLES.find((item) => item.id === roleId) ?? ROLES[0];
  const total = role.steps.length;
  const current = role.steps[step];

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => setStep((value) => (value + 1) % total), STEP_MS);
    return () => clearTimeout(timer);
  }, [paused, step, total, roleId]);

  const pick = (id: string) => {
    setRoleId(id);
    setStep(0);
  };

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div
        role="tablist"
        aria-label="Votre rôle"
        className="mx-auto flex w-fit gap-1 rounded-full border bg-card p-1"
      >
        {ROLES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={id === roleId}
            onClick={() => pick(id)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors duration-300 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              id === roleId
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="mt-12 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-16">
        <ol className="grid content-start">
          {role.steps.map(({ title, text }, index) => {
            const active = index === step;
            const done = index < step;
            return (
              <li key={`${roleId}-${title}`} className="relative">
                {index < total - 1 && (
                  <span
                    aria-hidden
                    className="absolute top-12 bottom-0 left-[1.15rem] w-px bg-border"
                  >
                    <span
                      className={cn(
                        "absolute inset-0 origin-top bg-primary transition-transform duration-700 ease-in-out motion-reduce:transition-none",
                        done ? "scale-y-100" : "scale-y-0",
                      )}
                    />
                  </span>
                )}
                <button
                  type="button"
                  aria-current={active ? "step" : undefined}
                  onClick={() => setStep(index)}
                  className="flex w-full cursor-pointer items-start gap-4 rounded-xl py-3 text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <span
                    className={cn(
                      "relative z-10 flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold tabular-nums transition-colors duration-500",
                      done || active
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-4" /> : pad(index + 1)}
                  </span>
                  <span className="grid gap-1 pb-3">
                    <span
                      className={cn(
                        "font-semibold transition-colors duration-300",
                        !active && "text-muted-foreground",
                      )}
                    >
                      {title}
                    </span>
                    <span
                      className={cn(
                        "grid transition-all duration-500 ease-out motion-reduce:transition-none",
                        active ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <span className="overflow-hidden text-sm leading-6 text-muted-foreground">
                        {text}
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>

        <div
          aria-live="polite"
          style={{
            backgroundImage:
              "radial-gradient(color-mix(in oklab, var(--foreground) 20%, transparent) 1px, transparent 1px)",
            backgroundSize: "8px 8px",
          }}
          className="flex min-h-80 items-center justify-center rounded-2xl border bg-muted/30 p-6 sm:p-10 lg:sticky lg:top-24 lg:self-start"
        >
          <div
            key={`${roleId}-${step}`}
            className="w-full max-w-sm animate-in rounded-2xl border bg-card p-6 shadow-sm duration-500 fade-in zoom-in-95 slide-in-from-bottom-3 motion-reduce:animate-none"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="flex size-11 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <current.icon className="size-5" />
              </span>
              <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                {current.badge}
              </span>
            </div>
            <p className="mt-5 text-lg font-semibold">{current.title}</p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">{current.text}</p>
            <ul className="mt-4 flex flex-wrap gap-1.5">
              {current.chips.map((chip) => (
                <li
                  key={chip}
                  className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {chip}
                </li>
              ))}
            </ul>
            <div className="mt-6 flex gap-1.5" aria-hidden>
              {role.steps.map((_, index) => (
                <span
                  key={index}
                  className={cn(
                    "h-1 flex-1 rounded-full transition-colors duration-500",
                    index <= step ? "bg-primary" : "bg-border",
                  )}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
