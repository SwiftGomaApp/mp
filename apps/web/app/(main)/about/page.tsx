import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, QrCode, ShieldCheck, Store, Wallet } from "lucide-react";

import { Reveal } from "@/components/global/reveal";
import { AboutRoles } from "@/components/about/about-roles";
import { AboutTimeline } from "@/components/about/about-timeline";

export const metadata: Metadata = {
  title: "À propos | SwiftGoma",
  description:
    "SwiftGoma est la place de marché de Goma : des vendeurs locaux, des livreurs et des acheteurs réunis dans un même endroit, avec un paiement sécurisé.",
};

const principles = [
  {
    icon: ShieldCheck,
    title: "La confiance d’abord",
    text: "L’argent de l’acheteur est mis de côté jusqu’à la remise du colis. Personne ne paie dans le vide.",
  },
  {
    icon: QrCode,
    title: "Une remise qui se prouve",
    text: "Chaque livraison se termine par un scan de code QR. Plus de « je n’ai rien reçu ».",
  },
  {
    icon: Wallet,
    title: "Un paiement qui arrive",
    text: "Les vendeurs et les livreurs retirent leurs gains par Mobile Money, sans intermédiaire.",
  },
  {
    icon: Store,
    title: "Pensé pour le commerce local",
    text: "Des boutiques de Goma, des livreurs de Goma, des clients de Goma. La ville d’abord.",
  },
] as const;

// TODO: replace with real figures once the backend exposes them.
const figures = [
  { value: "100 %", label: "du montant convenu reversé au livreur" },
  { value: "24 h", label: "de protection après chaque remise" },
  { value: "3", label: "rôles : acheteur, vendeur, livreur" },
] as const;

// TODO: replace with the real milestones.
const milestones = [
  {
    year: "2025",
    title: "L’idée",
    text: "Un constat simple : acheter et vendre à Goma demande trop de confiance aveugle.",
  },
  {
    year: "2026",
    title: "Le lancement",
    text: "Les premières boutiques ouvrent et les premiers colis sont livrés avec un code QR.",
  },
  {
    year: "Demain",
    title: "La suite",
    text: "Plus de quartiers, plus de catégories, plus de moyens de paiement.",
  },
] as const;

export default function AboutPage() {
  return (
    <main>
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28">
        <Reveal className="grid max-w-3xl gap-6">
          <p className="text-sm font-medium text-primary">À propos</p>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            La place de marché construite pour Goma.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            SwiftGoma réunit ceux qui vendent, ceux qui livrent et ceux qui achètent, avec une règle
            simple : chacun doit pouvoir faire confiance à l’autre sans le connaître.
          </p>
        </Reveal>
      </section>

      <section className="border-y bg-muted/30">
        <dl className="mx-auto grid w-full max-w-6xl divide-y px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0 sm:px-6">
          {figures.map(({ value, label }, index) => (
            <Reveal
              key={label}
              delay={index * 100}
              className="grid gap-1 py-8 sm:px-8 sm:first:pl-0"
            >
              <dt className="text-4xl font-bold tracking-tight tabular-nums">{value}</dt>
              <dd className="text-sm text-muted-foreground">{label}</dd>
            </Reveal>
          ))}
        </dl>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <Reveal>
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Pourquoi SwiftGoma existe
          </h2>
        </Reveal>
        <Reveal delay={100} className="grid gap-5 leading-7 text-muted-foreground">
          {/* TODO: write the real founding story. */}
          <p>
            À Goma, le commerce se fait déjà partout : sur les marchés, par message, de bouche à
            oreille. Ce qui manque, c’est un cadre qui protège tout le monde. L’acheteur craint de
            payer sans recevoir, le vendeur craint de livrer sans être payé, le livreur n’est pas
            toujours sûr de la course qu’il accepte.
          </p>
          <p>
            Nous avons construit SwiftGoma pour ça : une boutique en ligne simple pour les
            commerçants, des livreurs indépendants qui choisissent leurs courses, et un paiement mis
            de côté jusqu’à ce que le colis soit bien remis.
          </p>
        </Reveal>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <Reveal className="grid max-w-2xl gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Ce en quoi nous croyons
            </h2>
            <p className="leading-7 text-muted-foreground">
              Quatre principes guident chaque fonctionnalité que nous ajoutons.
            </p>
          </Reveal>

          <ul className="mt-12 grid gap-4 sm:grid-cols-2">
            {principles.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} delay={index * 80}>
                <li className="group h-full list-none rounded-2xl border bg-card p-6 transition-colors hover:border-foreground/30">
                  <span className="flex size-10 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                    <Icon className="size-5" />
                  </span>
                  <h3 className="mt-5 text-lg font-semibold">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </li>
              </Reveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Timeline */}
      <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <Reveal className="grid max-w-2xl gap-3">
          <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Notre parcours
          </h2>
          <p className="leading-7 text-muted-foreground">
            Ce qui a été fait, et ce qui vient ensuite.
          </p>
        </Reveal>

        <AboutTimeline milestones={milestones} />
      </section>

      <section className="border-t bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Une place pour chacun
            </h2>
          </Reveal>

          <AboutRoles />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
        <Reveal className="grid items-center gap-6 rounded-2xl border bg-card p-8 sm:p-12 md:grid-cols-[1fr_auto]">
          <div className="grid gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              Une question, une idée, un partenariat ?
            </h2>
            <p className="text-muted-foreground">
              Notre équipe lit chaque message. Passez par le centre d’aide, nous vous répondons.
            </p>
          </div>
          <Link
            href="/help#contact"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground transition-opacity outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Nous écrire
            <ArrowRight className="size-4" />
          </Link>
        </Reveal>
      </section>
    </main>
  );
}
