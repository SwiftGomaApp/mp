import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { CountUp } from "@/components/deliver/count-up";
import { LinkRequestDemo } from "@/components/deliver/link-request-demo";
import { RideScene } from "@/components/deliver/ride-scene";
import { RiderFaq } from "@/components/deliver/rider-faq";
import { RouteMap } from "@/components/deliver/route-map";
import { Reveal } from "@/components/global/reveal";
import { Button } from "@/components/ui/button";
import {
  riderAlerts,
  riderDocuments,
  riderEngagements,
  riderFreedoms,
  riderOnboarding,
  riderSteps,
  riderSuspensions,
} from "@/lib/deliver";
import { pageMetadata } from "@/lib/seo";
import { cn } from "@/lib/utils";

export const metadata = pageMetadata({
  title: "Devenir livreur",
  description:
    "Livrez à Goma comme livreur indépendant : choisissez vos boutiques, confirmez le montant avant de partir et retirez vos gains sur Mobile Money.",
  path: "/deliver",
});

const FADE =
  "animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both motion-reduce:animate-none";

const wrapClassName = "mx-auto w-full max-w-6xl px-4 sm:px-6";

const STATS = [
  {
    value: 100,
    unit: "%",
    text: "du montant convenu. Vous le confirmez avant de partir, il vous revient en entier.",
  },
  {
    value: 24,
    unit: "h",
    text: "d’attente après le scan du QR, puis l’argent est disponible dans votre portefeuille.",
  },
  {
    value: 10,
    unit: "min",
    text: "d’attente si l’acheteur est absent. Ensuite vous le signalez, et vous êtes payé quand même.",
  },
] as const;

export default function DeliverPage() {
  return (
    <>
      <section className={cn(wrapClassName, "pt-16 sm:pt-24")}>
        <div className="mx-auto grid max-w-3xl justify-items-center gap-6 text-center">
          <h1 className={cn("text-4xl font-bold tracking-tight text-balance sm:text-6xl", FADE)}>
            Livrez à Goma, à votre rythme.
          </h1>
          <p
            style={{ animationDelay: "100ms" }}
            className={cn("max-w-xl text-lg leading-7 text-muted-foreground", FADE)}
          >
            Devenez livreur indépendant. Vous choisissez vos boutiques, vous confirmez le montant
            avant de partir et vous êtes payé 100 % de ce montant.
          </p>
          <div
            style={{ animationDelay: "200ms" }}
            className={cn("flex flex-wrap items-center justify-center gap-x-6 gap-y-3", FADE)}
          >
            <Button size="lg" nativeButton={false} render={<Link href="/auth/sign-up" />}>
              Devenir livreur
            </Button>
            <Link
              href="/legale/rider-terms"
              className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
            >
              Lire les conditions livreur
            </Link>
          </div>
        </div>

        <div
          style={{ animationDelay: "350ms" }}
          className={cn("mx-auto mt-12 w-full max-w-4xl", FADE)}
        >
          <RouteMap />
        </div>
      </section>

      <section
        id="course"
        className="mt-24 scroll-mt-16 border-y bg-muted/40"
        aria-labelledby="course-titre"
      >
        <div className="mx-auto w-full max-w-6xl py-20">
          <Reveal className="px-4 sm:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="grid gap-3">
                <p className="text-sm font-medium text-primary">Une course</p>
                <h2
                  id="course-titre"
                  className="max-w-xl text-3xl font-bold tracking-tight text-balance sm:text-4xl"
                >
                  De la demande à la remise, en cinq gestes
                </h2>
              </div>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                Faites défiler
                <ArrowRight className="size-3.5" />
              </p>
            </div>
          </Reveal>

          <Reveal delay={100}>
            <ol className="mt-10 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-4 scrollbar-none sm:px-6 [&::-webkit-scrollbar]:hidden">
              {riderSteps.map(({ title, description }, index) => (
                <li key={title} className="w-72 shrink-0 snap-start">
                  <div className="group h-full rounded-2xl border bg-card p-6">
                    <span className="text-5xl font-bold text-muted-foreground/30 tabular-nums transition-colors duration-500 group-hover:text-primary">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-8 font-semibold">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        </div>
      </section>

      <section
        className={cn(wrapClassName, "grid items-center gap-14 py-24 lg:grid-cols-2 lg:gap-20")}
        aria-labelledby="alertes"
      >
        <Reveal className="grid content-center gap-4">
          <p className="text-sm font-medium text-primary">Vos demandes</p>
          <h2
            id="alertes"
            className="max-w-md text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          >
            Chaque course arrive sur votre téléphone
          </h2>
          <p className="max-w-md leading-7 text-muted-foreground">
            Une nouvelle course est une alerte importante : elle ne dépend pas de vos préférences de
            notification. Si vous ne l’ouvrez pas, un SMS vous est envoyé au bout de 2 minutes.
          </p>
        </Reveal>

        <Reveal delay={150}>
          <ul className="grid gap-2 rounded-2xl border bg-card p-3">
            {riderAlerts.map(({ title, detail, critical }) => (
              <li
                key={title}
                className={cn(
                  "flex items-start gap-3 rounded-xl px-4 py-3",
                  critical && "bg-muted",
                )}
              >
                <span className="relative mt-1.5 flex size-2 shrink-0">
                  {critical && (
                    <span className="absolute inline-flex size-full animate-ping rounded-full bg-primary opacity-60 motion-reduce:animate-none" />
                  )}
                  <span
                    className={cn(
                      "relative inline-flex size-2 rounded-full",
                      critical ? "bg-primary" : "bg-muted-foreground/60",
                    )}
                  />
                </span>
                <span className="grid flex-1 leading-tight">
                  <span className="text-sm font-medium">{title}</span>
                  <span className="mt-1 text-xs leading-5 text-muted-foreground">{detail}</span>
                </span>
                {critical && (
                  <span className="rounded-full border px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                    SMS après 2 min
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section className="border-t" aria-labelledby="gains">
        <div className={cn(wrapClassName, "py-24")}>
          <Reveal className="grid justify-items-center gap-3 text-center">
            <p className="text-sm font-medium text-primary">Vos gains</p>
            <h2
              id="gains"
              className="max-w-xl text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            >
              Ce que vous gagnez est clair avant de partir
            </h2>
          </Reveal>

          <dl className="mt-14 grid divide-y border-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {STATS.map(({ value, unit, text }) => (
              <div key={unit} className="grid content-start gap-3 px-2 py-10 text-center sm:px-8">
                <dt className="flex items-baseline justify-center gap-1.5">
                  <CountUp to={value} className="text-6xl font-bold tracking-tight tabular-nums" />
                  <span className="text-2xl font-semibold text-muted-foreground">{unit}</span>
                </dt>
                <dd className="mx-auto max-w-56 text-sm leading-6 text-muted-foreground">{text}</dd>
              </div>
            ))}
          </dl>

          <div className="mx-auto mt-8 grid max-w-2xl gap-3 text-center text-sm leading-6 text-muted-foreground">
            <p>
              Après le scan du QR, l’argent est réparti : la commission va à SwiftGoma, votre
              montant convenu va dans votre portefeuille, et le reste va au vendeur. Vous êtes payé
              dans la monnaie de la commande, sans conversion.
            </p>
            <p>
              Vous retirez votre solde disponible sur votre numéro Mobile Money, avec un code pour
              confirmer chaque retrait. Un minimum, un maximum et un plafond par jour existent, et
              les frais du fournisseur sont affichés avant la confirmation.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t" aria-labelledby="dossier">
        <div className={cn(wrapClassName, "grid gap-12 py-24 lg:grid-cols-[1fr_1.4fr] lg:gap-20")}>
          <Reveal className="grid content-start gap-4 lg:sticky lg:top-24 lg:self-start">
            <p className="text-sm font-medium text-primary">Votre dossier</p>
            <h2 id="dossier" className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Trois documents, vérifiés avant votre premier trajet
            </h2>
            <p className="max-w-sm leading-7 text-muted-foreground">
              Le Support examine votre dossier, puis un Admin prend la décision. Vous êtes prévenu à
              chaque étape, par notification, SMS ou e-mail.
            </p>
          </Reveal>

          <div className="grid gap-12">
            <Reveal delay={100}>
              <ul className="divide-y border-y">
                {riderDocuments.map(({ title, detail }) => (
                  <li key={title} className="grid gap-1 py-6">
                    <span className="text-lg font-semibold">{title}</span>
                    <span className="text-sm leading-6 text-muted-foreground">{detail}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-6 text-muted-foreground">
                Vos documents restent privés : seules les personnes autorisées de l’équipe les
                voient, et chaque consultation est notée.
              </p>
            </Reveal>

            <Reveal delay={100}>
              <h3 className="text-lg font-semibold">De l’inscription au premier trajet</h3>
              <ol className="mt-5 grid divide-y border-y">
                {riderOnboarding.map((step, index) => (
                  <li key={step} className="flex gap-4 py-4 text-sm leading-6">
                    <span className="w-6 shrink-0 text-muted-foreground tabular-nums">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-sm leading-6 text-muted-foreground">
                Dossier refusé ? Vous corrigez et vous renvoyez, avec 3 essais, puis vous contactez
                le Support. Tant qu’il n’est pas approuvé, vous ne pouvez ni être relié à une
                boutique ni recevoir de livraison.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="dark bg-background text-foreground" aria-labelledby="boutiques">
        <div
          className={cn(wrapClassName, "grid items-center gap-14 py-24 lg:grid-cols-2 lg:gap-20")}
        >
          <Reveal className="grid gap-6">
            <h2
              id="boutiques"
              className="text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            >
              Travaillez avec les boutiques de votre choix
            </h2>
            <ul className="grid gap-3">
              {riderFreedoms.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm leading-6">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-muted-foreground">{item}</span>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={150} className="grid justify-items-center lg:justify-items-end">
            <LinkRequestDemo />
          </Reveal>
        </div>
      </section>

      <section aria-labelledby="regles">
        <div className={cn(wrapClassName, "py-24")}>
          <Reveal className="grid justify-items-center gap-3 text-center">
            <p className="text-sm font-medium text-primary">Les règles</p>
            <h2
              id="regles"
              className="max-w-xl text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            >
              Ce que nous attendons de vous, et ce qui nous protège tous
            </h2>
          </Reveal>

          <div className="mt-14 grid gap-14 lg:grid-cols-2 lg:gap-20">
            <Reveal>
              <h3 className="text-lg font-semibold">Vos engagements</h3>
              <ul className="mt-5 divide-y border-y">
                {riderEngagements.map(({ title, detail }) => (
                  <li key={title} className="grid gap-1 py-4">
                    <span className="text-sm font-medium">{title}</span>
                    <span className="text-sm leading-6 text-muted-foreground">{detail}</span>
                  </li>
                ))}
              </ul>
            </Reveal>

            <Reveal delay={100}>
              <h3 className="text-lg font-semibold">Ce qui peut mener à une suspension</h3>
              <ul className="mt-5 divide-y border-y">
                {riderSuspensions.map((item) => (
                  <li key={item} className="py-4 text-sm">
                    {item}
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm leading-6 text-muted-foreground">
                Vous êtes alors déconnecté de tous vos appareils. Vous pouvez écrire au Support
                depuis l’écran de connexion : l’équipe examine votre demande et un Admin décide.
                Vous pouvez aussi mettre fin au contrat en supprimant votre compte, sauf tant qu’une
                livraison est en cours ou qu’un litige est ouvert.
              </p>
            </Reveal>
          </div>
        </div>
      </section>

      <section className="border-t bg-muted/40" aria-labelledby="questions">
        <div className={cn(wrapClassName, "py-24")}>
          <Reveal className="grid justify-items-center gap-3 text-center">
            <p className="text-sm font-medium text-primary">Questions</p>
            <h2
              id="questions"
              className="max-w-xl text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            >
              Ce que les livreurs nous demandent
            </h2>
          </Reveal>

          <Reveal delay={100} className="mt-12">
            <RiderFaq />
            <p className="mt-8 text-center text-sm text-muted-foreground">
              Une autre question ?{" "}
              <Link href="/help" className="underline underline-offset-4 hover:text-foreground">
                Centre d’aide
              </Link>
            </p>
          </Reveal>
        </div>
      </section>

      <section className="border-t" aria-labelledby="demarrer">
        <div
          className={cn(wrapClassName, "grid justify-items-center gap-8 pt-20 pb-28 text-center")}
        >
          <RideScene className="w-full max-w-md" />

          <Reveal className="grid justify-items-center gap-6">
            <h2
              id="demarrer"
              className="max-w-xl text-3xl font-bold tracking-tight text-balance sm:text-5xl"
            >
              Prêt à prendre la route ?
            </h2>
            <p className="max-w-md leading-7 text-muted-foreground">
              Créez votre compte livreur, acceptez le contrat dans l’application et envoyez vos
              documents. Le contrat est à lire avant d’accepter.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3">
              <Button size="lg" nativeButton={false} render={<Link href="/auth/sign-up" />}>
                Devenir livreur
              </Button>
              <Link
                href="/legale/rider-terms"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Lire les conditions livreur
              </Link>
            </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
