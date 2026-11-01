import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Ban,
  CircleDollarSign,
  EyeOff,
  Lock,
  Siren,
  Unlock,
  UserX,
  WalletCards,
  type LucideIcon,
} from "lucide-react";

import { Journey } from "@/components/how-it-works/journey";
import { Reveal } from "@/components/global/reveal";

export const metadata: Metadata = {
  title: "Comment ça marche | SwiftGoma",
  description:
    "De la commande à la livraison : paiement retenu en sécurité, code QR de remise, délais et recours, expliqués pour l’acheteur, le vendeur et le livreur.",
};

const timings = [
  { value: "5 min", label: "pour confirmer le paiement sur votre téléphone" },
  { value: "15 min", label: "au vendeur pour accepter ou refuser" },
  { value: "10 min", label: "d’attente du livreur si l’acheteur est absent" },
  { value: "24 h", label: "d’attente de l’argent après le scan du QR" },
  { value: "48 h", label: "avant confirmation automatique sans scan" },
  { value: "7 jours", label: "pour noter ou signaler un problème" },
] as const;

const moneyFlow = [
  {
    icon: CircleDollarSign,
    title: "L’acheteur paie",
    text: "Par Mobile Money, dans la monnaie de la boutique (dollars ou francs congolais).",
  },
  {
    icon: Lock,
    title: "L’argent est retenu",
    text: "Il n’arrive dans aucun portefeuille tant que le code QR n’est pas scanné.",
  },
  {
    icon: Unlock,
    title: "Il est réparti",
    text: "Au scan : la commission va à SwiftGoma, le montant convenu au livreur, le reste au vendeur.",
  },
  {
    icon: WalletCards,
    title: "Il devient disponible",
    text: "Après 24 heures, pour laisser le temps de signaler un problème. Retrait sur Mobile Money.",
  },
] as const;

// TODO: launch grid, to be confirmed by Finance (see README, open decisions).
const commission = [
  { range: "Moins de 20 $", rate: "12 %" },
  { range: "De 20 $ à 100 $", rate: "8 %" },
  { range: "Plus de 100 $", rate: "5 %" },
] as const;

const cases: { icon: LucideIcon; situation: string; outcome: string }[] = [
  {
    icon: Ban,
    situation: "Le paiement échoue ou est annulé",
    outcome: "Aucune commande n’est créée et votre panier est conservé pour réessayer.",
  },
  {
    icon: Siren,
    situation: "Le vendeur refuse ou ne répond pas",
    outcome: "Vous êtes remboursé automatiquement et prévenu.",
  },
  {
    icon: Ban,
    situation: "Vous voulez annuler",
    outcome:
      "Avant l’acceptation du vendeur, c’est possible et remboursé. Après, signalez un problème : le Support examine votre demande.",
  },
  {
    icon: UserX,
    situation: "Vous êtes absent à la livraison",
    outcome:
      "Le livreur attend 10 minutes et vous appelle. La commande revient au vendeur, le livreur est payé, et le Support décide d’un éventuel remboursement.",
  },
  {
    icon: EyeOff,
    situation: "Le scan n’a pas été fait",
    outcome:
      "Vous recevez un message pour confirmer la réception. Sans réponse en 48 heures et sans problème signalé, la remise est confirmée automatiquement.",
  },
  {
    icon: Siren,
    situation: "Un problème après la remise",
    outcome:
      "Pendant 7 jours, signalez un article non reçu, abîmé ou erroné. Le Support examine, un Admin décide si besoin. L’argent concerné reste en attente jusqu’à la décision.",
  },
];

export default function HowItWorksPage() {
  return (
    <main>
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28">
        <Reveal className="mx-auto grid max-w-3xl gap-6 text-center">
          <p className="text-sm font-medium text-primary">Comment ça marche</p>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            De la commande à la porte, sans mauvaise surprise.
          </h1>
          <p className="text-lg leading-8 text-muted-foreground">
            Choisissez votre rôle et suivez le parcours. L’argent de l’acheteur est retenu en
            sécurité jusqu’à ce qu’il confirme la réception avec un code QR.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <Journey />
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <Reveal className="grid max-w-2xl gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Les délais à retenir
            </h2>
            <p className="leading-7 text-muted-foreground">
              Chaque attente est limitée, pour que personne ne reste bloqué.
            </p>
          </Reveal>

          <dl className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {timings.map(({ value, label }, index) => (
              <Reveal key={value} delay={index * 70}>
                <div className="h-full rounded-2xl border bg-card p-6">
                  <dt className="text-4xl font-bold tracking-tight tabular-nums">{value}</dt>
                  <dd className="mt-2 text-sm leading-6 text-muted-foreground">{label}</dd>
                </div>
              </Reveal>
            ))}
          </dl>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <Reveal className="grid max-w-2xl gap-3">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Où va l’argent
          </h2>
          <p className="leading-7 text-muted-foreground">
            Le paiement suit la livraison, jamais l’inverse.
          </p>
        </Reveal>

        <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {moneyFlow.map(({ icon: Icon, title, text }, index) => (
            <Reveal key={title} delay={index * 100}>
              <li className="h-full list-none rounded-2xl border bg-card p-6">
                <div className="flex items-center justify-between">
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted">
                    <Icon className="size-5" />
                  </span>
                  <span className="text-5xl font-bold text-foreground/10 tabular-nums">
                    {index + 1}
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </li>
            </Reveal>
          ))}
        </ol>

        <div className="mt-8 grid gap-4 lg:grid-cols-2">
          <Reveal>
            <div className="h-full rounded-2xl border bg-card p-6 sm:p-8">
              <p className="text-sm font-medium text-muted-foreground">Exemple illustratif</p>
              <p className="mt-1 text-lg font-semibold">
                Commande de 50 $ livrée, livreur convenu à 3 $
              </p>
              <div
                role="img"
                aria-label="Répartition : commission 4 dollars, livreur 3 dollars, vendeur 43 dollars"
                className="mt-6 flex h-3 overflow-hidden rounded-full bg-muted"
              >
                <span className="bg-primary" style={{ width: "8%" }} />
                <span className="bg-foreground/60" style={{ width: "6%" }} />
                <span className="bg-foreground/20" style={{ width: "86%" }} />
              </div>
              <ul className="mt-5 grid gap-3 text-sm">
                <li className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-primary" />
                    Commission SwiftGoma (8 %)
                  </span>
                  <span className="font-medium tabular-nums">4 $</span>
                </li>
                <li className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-foreground/60" />
                    Livreur (montant convenu)
                  </span>
                  <span className="font-medium tabular-nums">3 $</span>
                </li>
                <li className="flex items-center justify-between gap-4">
                  <span className="flex items-center gap-2">
                    <span className="size-2.5 rounded-full bg-foreground/20" />
                    Vendeur (le reste)
                  </span>
                  <span className="font-medium tabular-nums">43 $</span>
                </li>
              </ul>
            </div>
          </Reveal>

          <Reveal delay={120}>
            <div className="h-full rounded-2xl border bg-card p-6 sm:p-8">
              <p className="text-sm font-medium text-muted-foreground">
                Commission sur le total des produits
              </p>
              <p className="mt-1 text-lg font-semibold">
                Plus la commande est grande, moins elle coûte
              </p>
              <ul className="mt-6 divide-y border-y">
                {commission.map(({ range, rate }) => (
                  <li key={range} className="flex items-center justify-between py-4">
                    <span className="text-sm text-muted-foreground">{range}</span>
                    <span className="text-2xl font-bold tabular-nums">{rate}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-xs leading-5 text-muted-foreground">
                Mêmes pourcentages en francs congolais, avec les seuils équivalents. Le prix affiché
                à l’acheteur inclut déjà la livraison.
              </p>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <Reveal className="grid max-w-2xl gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Et si quelque chose ne se passe pas comme prévu ?
            </h2>
            <p className="leading-7 text-muted-foreground">
              Chaque cas a une règle claire, appliquée de la même façon pour tout le monde.
            </p>
          </Reveal>

          <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {cases.map(({ icon: Icon, situation, outcome }, index) => (
              <Reveal key={situation} delay={(index % 3) * 100}>
                <li className="group h-full list-none rounded-2xl border bg-card p-6 transition-colors hover:border-foreground/30">
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 font-semibold">{situation}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{outcome}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <Reveal className="grid items-center gap-6 rounded-2xl border bg-card p-8 sm:p-12 md:grid-cols-[1fr_auto]">
          <div className="grid gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              Prêt à essayer ?
            </h2>
            <p className="text-muted-foreground">
              Créez votre compte en quelques minutes, ou lisez les réponses aux questions
              fréquentes.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/auth/sign-up"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Créer un compte
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/help"
              className="inline-flex h-11 items-center justify-center rounded-full border px-6 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Centre d’aide
            </Link>
          </div>
        </Reveal>
      </section>
    </main>
  );
}
