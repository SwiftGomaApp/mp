import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bike,
  Building2,
  Check,
  FileCheck2,
  FileSignature,
  Rocket,
  Store,
  type LucideIcon,
} from "lucide-react";

import { Reveal } from "@/components/global/reveal";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Devenir partenaire | SwiftGoma",
  description:
    "Vendez vos produits, livrez les commandes ou travaillez avec SwiftGoma : choisissez comment rejoindre la place de marché de Goma.",
};

const paths: {
  icon: LucideIcon;
  title: string;
  text: string;
  points: string[];
  href: string;
  cta: string;
  dots: string;
}[] = [
  {
    icon: Store,
    title: "Vendeur",
    text: "Ouvrez votre boutique en ligne et vendez à toute la ville.",
    points: [
      "Vous fixez vos prix, votre stock et vos horaires",
      "Paiement retenu en sécurité jusqu’à la remise",
      "Retrait de vos gains sur Mobile Money",
    ],
    href: "/sell",
    cta: "Vendre sur SwiftGoma",
    dots: "var(--color-blue-500)",
  },
  {
    icon: Bike,
    title: "Livreur",
    text: "Livrez avec votre moto ou votre voiture, quand vous voulez.",
    points: [
      "Vous choisissez vos boutiques et vos courses",
      "100 % du montant convenu pour chaque course",
      "Remise prouvée par code QR",
    ],
    href: "/deliver",
    cta: "Devenir livreur",
    dots: "var(--color-emerald-500)",
  },
];

const compare = [
  {
    label: "Ce que vous faites",
    seller: "Vous vendez vos produits",
    rider: "Vous livrez les commandes",
  },
  {
    label: "Documents demandés",
    seller:
      "Pièce d’identité et selfie, registre de commerce, numéro d’impôt, photos de la boutique",
    rider: "Pièce d’identité et selfie, permis, photos du véhicule et de la plaque",
  },
  {
    label: "Vérification",
    seller: "Le Support vérifie, un Admin décide. 3 essais.",
    rider: "Le Support vérifie, un Admin décide. 3 essais.",
  },
  {
    label: "Vos gains",
    seller: "Le prix de vos produits, moins une commission de 5 à 12 %",
    rider: "100 % du montant convenu pour chaque course",
  },
  {
    label: "Disponibilité",
    seller: "24 heures après la remise confirmée",
    rider: "24 heures après la remise confirmée",
  },
  {
    label: "Retrait",
    seller: "Mobile Money, au même nom que votre pièce d’identité",
    rider: "Mobile Money",
  },
] as const;

const process: { icon: LucideIcon; title: string; text: string }[] = [
  {
    icon: FileSignature,
    title: "Créez votre compte",
    text: "Choisissez votre rôle, lisez le contrat et acceptez-le dans l’application avec un code reçu sur votre téléphone.",
  },
  {
    icon: FileCheck2,
    title: "Envoyez votre dossier",
    text: "Vos documents sont gardés en privé. Le Support les vérifie, puis un Admin approuve ou refuse en expliquant pourquoi.",
  },
  {
    icon: Rocket,
    title: "Commencez",
    text: "Une fois approuvé, vous êtes prévenu. L’application vous montre ce qu’il reste à faire avant d’être actif.",
  },
];

const checklist = [
  "Un numéro de téléphone de la RDC (+243)",
  "Une pièce d’identité valide et un selfie",
  "Un numéro Mobile Money à votre nom",
  "Des informations exactes, que vous mettez à jour en cas de changement",
] as const;

export default function PartnersPage() {
  return (
    <main>
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 pb-16 sm:px-6 sm:pt-28">
        <Reveal className="mx-auto grid max-w-3xl gap-6 text-center">
          <p className="text-sm font-medium text-primary">Devenir partenaire</p>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Travaillez avec SwiftGoma, à votre façon.
          </h1>
          <p className="text-lg leading-8 text-muted-foreground">
            Vendre, livrer ou construire quelque chose avec nous : choisissez le chemin qui vous
            ressemble. Dans tous les cas, l’argent suit la livraison.
          </p>
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <div className="grid gap-4 md:grid-cols-2">
          {paths.map(({ icon: Icon, title, text, points, href, cta, dots }, index) => (
            <Reveal key={title} delay={index * 120}>
              <Link
                href={href}
                style={{ "--dots": dots } as React.CSSProperties}
                className="group relative flex h-full flex-col gap-6 overflow-hidden rounded-3xl border bg-card p-8 outline-none transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50 sm:p-10"
              >
                <span
                  aria-hidden
                  style={{
                    backgroundImage: "radial-gradient(var(--dots) 1.2px, transparent 1.2px)",
                    backgroundSize: "8px 8px",
                  }}
                  className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-700 mask-[radial-gradient(circle_at_100%_0%,black,transparent_65%)] group-hover:opacity-60 motion-reduce:transition-none"
                />
                <span className="relative flex size-12 items-center justify-center rounded-full bg-muted transition-colors duration-500 group-hover:bg-primary group-hover:text-primary-foreground">
                  <Icon className="size-6" />
                </span>
                <div className="relative grid gap-2">
                  <h2 className="text-2xl font-bold tracking-tight">{title}</h2>
                  <p className="text-muted-foreground">{text}</p>
                </div>
                <ul className="relative grid flex-1 content-start gap-2.5 text-sm">
                  {points.map((point) => (
                    <li key={point} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {point}
                    </li>
                  ))}
                </ul>
                <span className="relative inline-flex items-center gap-2 text-sm font-medium">
                  {cta}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
                </span>
              </Link>
            </Reveal>
          ))}
        </div>

        <Reveal delay={240} className="mt-4">
          <div className="grid items-center gap-6 rounded-3xl border bg-muted/30 p-8 sm:p-10 md:grid-cols-[auto_1fr_auto]">
            <span className="flex size-12 items-center justify-center rounded-full bg-muted">
              <Building2 className="size-6" />
            </span>
            <div className="grid gap-1">
              <h2 className="text-xl font-bold tracking-tight">
                Entreprise, association, institution ?
              </h2>
              <p className="text-sm leading-6 text-muted-foreground">
                Vous voulez travailler avec SwiftGoma autrement que comme vendeur ou livreur ?
                Écrivez-nous et parlons de ce qui est possible.
              </p>
            </div>
            <Link
              href="/contact"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border bg-background px-6 text-sm font-medium transition-colors outline-none hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Nous contacter
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </Reveal>
      </section>

      <section className="border-y bg-muted/30">
        <div className="mx-auto w-full max-w-6xl px-4 py-24 sm:px-6">
          <Reveal className="grid max-w-2xl gap-3">
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Vendeur ou livreur : la comparaison
            </h2>
            <p className="leading-7 text-muted-foreground">
              Les deux parcours se ressemblent. Seuls les documents et la façon d’être payé
              changent.
            </p>
          </Reveal>

          <Reveal delay={100} className="mt-12">
            <div className="overflow-x-auto rounded-2xl border bg-card">
              <table className="w-full min-w-160 border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b">
                    <th scope="col" className="w-1/4 p-5 font-medium text-muted-foreground">
                      <span className="sr-only">Critère</span>
                    </th>
                    <th scope="col" className="p-5 font-semibold">
                      <span className="inline-flex items-center gap-2">
                        <Store className="size-4" /> Vendeur
                      </span>
                    </th>
                    <th scope="col" className="p-5 font-semibold">
                      <span className="inline-flex items-center gap-2">
                        <Bike className="size-4" /> Livreur
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {compare.map(({ label, seller, rider }, index) => (
                    <tr
                      key={label}
                      className={cn(
                        "align-top transition-colors hover:bg-muted/40",
                        index < compare.length - 1 && "border-b",
                      )}
                    >
                      <th scope="row" className="p-5 font-medium text-muted-foreground">
                        {label}
                      </th>
                      <td className="p-5 leading-6">{seller}</td>
                      <td className="p-5 leading-6">{rider}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-24 sm:px-6 lg:grid-cols-[1.3fr_1fr] lg:gap-16">
        <div>
          <Reveal>
            <h2 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
              Comment rejoindre
            </h2>
          </Reveal>

          <ol className="mt-10 grid gap-0">
            {process.map(({ icon: Icon, title, text }, index) => (
              <Reveal key={title} delay={index * 120}>
                <li className="relative flex list-none gap-5 pb-10 last:pb-0">
                  {index < process.length - 1 && (
                    <span
                      aria-hidden
                      className="absolute top-12 bottom-0 left-[1.4rem] w-px bg-border"
                    />
                  )}
                  <span className="relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full border bg-card">
                    <Icon className="size-5" />
                  </span>
                  <div className="grid gap-1 pt-1.5">
                    <h3 className="font-semibold">
                      <span className="mr-2 text-primary tabular-nums">{index + 1}.</span>
                      {title}
                    </h3>
                    <p className="max-w-lg text-sm leading-6 text-muted-foreground">{text}</p>
                  </div>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>

        <Reveal delay={150}>
          <aside className="rounded-2xl border bg-card p-6 sm:p-8 lg:sticky lg:top-24">
            <h3 className="text-lg font-semibold">Avant de postuler</h3>
            <p className="mt-1 text-sm text-muted-foreground">Gardez ces éléments sous la main.</p>
            <ul className="mt-6 grid gap-3 text-sm">
              {checklist.map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="size-3" />
                  </span>
                  <span className="leading-6">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 border-t pt-4 text-xs leading-5 text-muted-foreground">
              Un document refusé ? Vous corrigez et vous renvoyez, 3 essais au total, puis vous
              contactez le Support.
            </p>
          </aside>
        </Reveal>
      </section>

      <section className="mx-auto w-full max-w-6xl px-4 pb-24 sm:px-6">
        <Reveal className="grid items-center gap-6 rounded-2xl border bg-card p-8 sm:p-12 md:grid-cols-[1fr_auto]">
          <div className="grid gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-balance sm:text-3xl">
              Prêt à rejoindre SwiftGoma ?
            </h2>
            <p className="text-muted-foreground">
              Créez votre compte, puis choisissez votre rôle. Une question avant ? Le centre d’aide
              répond.
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
