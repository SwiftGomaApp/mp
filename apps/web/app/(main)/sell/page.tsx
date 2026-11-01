import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";

import { Reveal } from "@/components/global/reveal";
import { OrderTimeline } from "@/components/sell/order-timeline";
import { HeroDemo } from "@/components/sell/hero-demo";
import { TestimonialWall } from "@/components/sell/testimonial-wall";
import { PinnedShowcase } from "@/components/sell/pinned-showcase";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { pageMetadata } from "@/lib/seo";
import {
  payoutSteps,
  sellerDocuments,
  sellerQuestions,
  sellerRequirements,
  sellerSteps,
} from "@/lib/sell";
import { cn } from "@/lib/utils";

export const metadata = pageMetadata({
  title: "Vendre sur SwiftGoma",
  description:
    "Ouvrez votre boutique en ligne à Goma : touchez de nouveaux clients, soyez payé en sécurité et retirez vos gains sur Mobile Money.",
  path: "/sell",
});

const FADE =
  "animate-in fade-in slide-in-from-bottom-3 duration-700 fill-mode-both motion-reduce:animate-none";

const wrapClassName = "mx-auto w-full max-w-6xl px-4 sm:px-6";

function SectionIntro({
  eyebrow,
  title,
  description,
  link,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  description: string;
  link?: { href: string; label: string };
  align?: "center" | "left";
}) {
  return (
    <Reveal
      className={cn(
        "grid gap-4",
        align === "center" ? "justify-items-center text-center" : "justify-items-start",
      )}
    >
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2 className="max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl">
        {title}
      </h2>
      <p className="max-w-xl leading-7 text-muted-foreground">{description}</p>
      {link && (
        <Link
          href={link.href}
          className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary"
        >
          {link.label}
          <ArrowRight className="size-3.5" />
        </Link>
      )}
    </Reveal>
  );
}

const PAYOUT_DOT_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#eab308", "#f97316"] as const;

const STEP_IMAGES = [
  "/sell-create-account.jpg",
  "/sell-submit-docs.jpg",
  "/sell-accept-contrat.jpg",
  "/sell-shop-validated.jpg",
  "/sell-publish-products.jpg",
  "/sell-recieve-orders.jpg",
] as const;

export default function SellPage() {
  return (
    <>
      <section className={cn(wrapClassName, "pt-16 sm:pt-24")}>
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="grid max-w-2xl gap-5">
            <h1 className={cn("text-4xl font-bold tracking-tight text-balance sm:text-6xl", FADE)}>
              Tout pour vendre à Goma.
            </h1>
            <p
              style={{ animationDelay: "100ms" }}
              className={cn("max-w-md text-lg leading-7 text-muted-foreground", FADE)}
            >
              Plus qu’une vitrine. La boutique, les commandes, la livraison et le paiement au même
              endroit.
            </p>
          </div>

          <div
            style={{ animationDelay: "200ms" }}
            className={cn(
              "flex items-center gap-4 rounded-full border bg-card py-2 pr-2 pl-5 shadow-sm",
              FADE,
            )}
          >
            <span className="text-sm text-muted-foreground">Compte vendeur gratuit</span>
            <Button
              className="rounded-full"
              nativeButton={false}
              render={<Link href="/auth/sign-up" />}
            >
              Ouvrir ma boutique
            </Button>
          </div>
        </div>

        <div style={{ animationDelay: "300ms" }} className={cn("mt-12", FADE)}>
          <HeroDemo />
        </div>
      </section>

      <section className={cn(wrapClassName, "py-14")} aria-label="Moyens de paiement">
        <Reveal>
          <p className="text-center text-sm text-muted-foreground">
            Vos clients paient avec ce qu’ils ont déjà
          </p>
          <ul className="mt-6 grid grid-cols-2 items-center gap-6 text-center text-lg font-semibold tracking-tight sm:grid-cols-4">
            {["M-Pesa", "Airtel Money", "Orange Money", "Carte bancaire"].map((method) => (
              <li key={method} className="text-foreground/70">
                {method}
              </li>
            ))}
          </ul>
        </Reveal>
      </section>

      <section className="dark bg-background text-foreground" aria-labelledby="avantages">
        <PinnedShowcase />
      </section>

      <section id="comment" className="scroll-mt-16 bg-muted/40" aria-labelledby="etapes">
        <div className={cn(wrapClassName, "py-24")}>
          <SectionIntro
            align="left"
            eyebrow="Comment ça marche"
            title="De l’inscription à votre première vente"
            description="Six étapes, toutes depuis votre téléphone. Le Support vous accompagne si un document pose problème."
          />
          <h2 id="etapes" className="sr-only">
            Les étapes pour vendre
          </h2>

          <ol className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {sellerSteps.map(({ title, description }, index) => {
              return (
                <li key={title}>
                  <Reveal
                    delay={(index % 3) * 100}
                    className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card"
                  >
                    <div className="relative h-44 overflow-hidden border-b bg-muted/40">
                      <Image
                        src={STEP_IMAGES[index]}
                        alt=""
                        fill
                        sizes="(min-width: 1024px) 384px, (min-width: 640px) 50vw, 100vw"
                        className="object-cover grayscale transition-[filter] duration-700 ease-out group-hover:grayscale-0 motion-reduce:transition-none"
                      />
                      <span className="absolute top-3 left-3 rounded-full bg-background/80 px-2 py-0.5 text-xs text-foreground tabular-nums backdrop-blur">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                    </div>
                    <div className="grid gap-2 p-5">
                      <h3 className="font-semibold">{title}</h3>
                      <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                    </div>
                  </Reveal>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section className="dark bg-background text-foreground" aria-labelledby="paiement">
        <div className={cn(wrapClassName, "py-24")}>
          <SectionIntro
            eyebrow="Paiement"
            title="Payé en toute sécurité"
            description="L’argent n’est jamais dans votre portefeuille avant la remise. Après le scan du code QR, il est réparti et devient disponible au bout de 24 heures."
          />
          <h2 id="paiement" className="sr-only">
            Comment vous êtes payé
          </h2>

          <ol className="mt-16 grid divide-border overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-5 lg:divide-x [&>li]:border-b [&>li]:last:border-b-0 sm:[&>li]:border-b-0 sm:[&>li:nth-child(-n+4)]:border-b lg:[&>li]:border-b-0">
            {payoutSteps.map(({ title, description }, index) => (
              <li key={title} className="group relative grid content-start gap-3 p-6">
                <span
                  aria-hidden
                  style={{
                    backgroundImage: `radial-gradient(${PAYOUT_DOT_COLORS[index]} 1.2px, transparent 1.2px)`,
                    backgroundSize: "8px 8px",
                    maskImage: "radial-gradient(circle at 50% 40%, black 0%, transparent 85%)",
                  }}
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 ease-out group-hover:opacity-100"
                />
                <Reveal delay={index * 80} className="relative grid gap-3">
                  <span className="flex size-8 items-center justify-center rounded-full border text-xs text-muted-foreground tabular-nums">
                    {index + 1}
                  </span>
                  <h3 className="text-sm font-semibold">{title}</h3>
                  <p className="text-sm leading-6 text-muted-foreground">{description}</p>
                </Reveal>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section aria-labelledby="preparer">
        <div className={cn(wrapClassName, "grid gap-16 py-24 lg:grid-cols-2 lg:gap-12")}>
          {[
            {
              id: "preparer",
              title: "Ce qu’il faut préparer",
              description:
                "Les documents demandés pour vérifier votre boutique. Les pièces exactes exigées en RDC sont confirmées avant le lancement.",
              items: sellerDocuments,
            },
            {
              id: "actif",
              title: "Pour être actif",
              description:
                "Votre boutique devient visible quand tout est en place. L’application vous montre ce qu’il reste à faire.",
              items: sellerRequirements,
            },
          ].map(({ id, title, description, items }, column) => (
            <Reveal key={id} delay={column * 120} className="grid content-start gap-8">
              <div className="grid gap-3 text-center">
                <h2 id={id} className="text-2xl font-bold tracking-tight">
                  {title}
                </h2>
                <p className="mx-auto max-w-sm text-sm leading-6 text-muted-foreground">
                  {description}
                </p>
              </div>
              <ul className="grid divide-y overflow-hidden rounded-2xl border">
                {items.map((item) => (
                  <li key={item} className="flex items-center gap-3 px-5 py-4 text-sm">
                    <Check className="size-4 shrink-0 text-primary" />
                    {item}
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="border-t" aria-labelledby="temoignages">
        <TestimonialWall />
      </section>

      <section className="border-t bg-muted/40" aria-labelledby="questions">
        <div className={cn(wrapClassName, "grid gap-12 py-24 lg:grid-cols-[1fr_1.6fr] lg:gap-20")}>
          <SectionIntro
            align="left"
            eyebrow="Questions"
            title="Ce que les vendeurs nous demandent"
            description="Vous ne trouvez pas votre réponse ? Le Support vous répond depuis le centre d’aide."
            link={{ href: "/help", label: "Centre d’aide" }}
          />
          <h2 id="questions" className="sr-only">
            Questions de vendeurs
          </h2>
          <Reveal delay={100}>
            <Accordion className="rounded-2xl border bg-card px-6">
              {sellerQuestions.map(({ question, answer }) => (
                <AccordionItem key={question} value={question}>
                  <AccordionTrigger className="py-5 text-base font-medium hover:no-underline">
                    {question}
                  </AccordionTrigger>
                  <AccordionContent className="max-w-xl text-sm leading-6 text-muted-foreground">
                    {answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Reveal>
        </div>
      </section>

      <section className="dark bg-background text-foreground" aria-labelledby="demarrer">
        <div
          className={cn(wrapClassName, "grid items-center gap-14 py-28 lg:grid-cols-2 lg:gap-20")}
        >
          <Reveal className="grid justify-items-center gap-6 text-center lg:justify-items-start lg:text-left">
            <h2
              id="demarrer"
              className="max-w-xl text-3xl font-bold tracking-tight text-balance sm:text-4xl"
            >
              Prêt à ouvrir votre boutique ?
            </h2>
            <p className="max-w-md leading-7 text-muted-foreground">
              Créez votre compte vendeur en quelques minutes. Les conditions vendeur sont à lire
              avant d’accepter le contrat.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-3 lg:justify-start">
              <Button size="lg" nativeButton={false} render={<Link href="/auth/sign-up" />}>
                Ouvrir ma boutique
              </Button>
              <Link
                href="/legale/seller-terms"
                className="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
              >
                Lire les conditions vendeur
              </Link>
            </div>
          </Reveal>
          <Reveal delay={150} className="grid justify-items-center lg:justify-items-end">
            <OrderTimeline />
          </Reveal>
        </div>
      </section>
    </>
  );
}
