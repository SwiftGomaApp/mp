"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

import {
  AlertsMock,
  DocumentsMock,
  QrMock,
  RiderMock,
  ShopMock,
  WalletMock,
} from "@/components/sell/mocks";
import { cn } from "@/lib/utils";

interface Card {
  title: string;
  description: string;
  mock: React.ReactNode;
  wide?: boolean;
}

interface Group {
  label: string;
  cards: [Card, Card];
}

const GROUPS: Group[] = [
  {
    label: "Vitrine et paiement",
    cards: [
      {
        wide: true,
        title: "Une vitrine pour tout Goma",
        description:
          "Vos produits sont visibles par les habitants de la ville, classés par catégorie et par distance. Votre boutique est ouverte même quand la porte est fermée.",
        mock: <ShopMock className="max-w-sm translate-y-4" />,
      },
      {
        title: "Un paiement sans risque",
        description:
          "L’argent de l’acheteur est retenu en sécurité, puis versé quand il confirme la réception avec son code QR.",
        mock: <QrMock />,
      },
    ],
  },
  {
    label: "Livraison et gains",
    cards: [
      {
        title: "Des livreurs vérifiés",
        description:
          "Vous choisissez parmi des livreurs indépendants dont l’identité a été vérifiée, et vous convenez du montant avec eux.",
        mock: <RiderMock className="translate-y-4" />,
      },
      {
        wide: true,
        title: "Vos gains sur Mobile Money",
        description:
          "Les ventes arrivent dans votre portefeuille, en dollars ou en francs congolais selon votre boutique. Vous retirez quand vous voulez.",
        mock: <WalletMock className="max-w-sm translate-y-4" />,
      },
    ],
  },
  {
    label: "Dossier et commandes",
    cards: [
      {
        title: "Un dossier clair",
        description:
          "Vous voyez où en est la vérification de vos documents, et ce qu’il reste à faire pour que votre boutique soit visible.",
        mock: <DocumentsMock className="translate-y-4" />,
      },
      {
        wide: true,
        title: "Chaque commande, tout de suite",
        description:
          "Son et vibration à chaque nouvelle commande, pour ne rien manquer, même derrière le comptoir.",
        mock: <AlertsMock className="translate-y-2" />,
      },
    ],
  },
];

const HEADER_HEIGHT = 64;

function ShowCard({ title, description, mock, wide }: Card) {
  return (
    <article
      className={cn(
        "group relative flex min-h-92 flex-col overflow-hidden rounded-2xl border bg-card p-6 lg:min-h-0",
        wide && "md:col-span-2",
      )}
    >
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{description}</p>
      <div className="mt-6 grid justify-items-center transition-transform duration-500 ease-out group-hover:-translate-y-1.5">
        {mock}
      </div>
    </article>
  );
}

export function PinnedShowcase() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const update = useCallback(() => {
    const wrapper = wrapperRef.current;
    const stage = stageRef.current;
    if (!wrapper || !stage) return;
    const { top, height } = wrapper.getBoundingClientRect();
    const distance = height - stage.offsetHeight;
    if (distance <= 0) return;
    const progress = Math.min(1, Math.max(0, (HEADER_HEIGHT - top) / distance));
    setActive(Math.min(GROUPS.length - 1, Math.floor(progress * GROUPS.length)));
  }, []);

  useEffect(() => {
    const frame = requestAnimationFrame(update);
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [update]);

  function goTo(index: number) {
    const wrapper = wrapperRef.current;
    const stage = stageRef.current;
    if (!wrapper || !stage) return;
    const distance = wrapper.offsetHeight - stage.offsetHeight;
    const top = wrapper.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({
      top: top - HEADER_HEIGHT + ((index + 0.5) / GROUPS.length) * distance,
      behavior: "smooth",
    });
  }

  return (
    <div ref={wrapperRef} className="lg:h-[340svh]">
      <div
        ref={stageRef}
        className="mx-auto flex w-full max-w-6xl flex-col px-4 py-24 sm:px-6 lg:sticky lg:top-16 lg:py-10"
      >
        <div className="grid shrink-0 justify-items-center gap-4 text-center">
          <p className="text-sm font-medium text-primary">Pour les vendeurs</p>
          <h2
            id="avantages"
            className="max-w-2xl text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          >
            Une boutique qui évolue avec vous
          </h2>
          <p className="max-w-xl leading-7 text-muted-foreground">
            Une vitrine visible de toute la ville, un paiement sans risque et des livreurs vérifiés.
            Vous vous occupez de vos produits, SwiftGoma s’occupe du reste.
          </p>
          <Link
            href="#comment"
            className="inline-flex items-center gap-1.5 text-sm font-medium transition-colors hover:text-primary"
          >
            Voir les étapes
            <ArrowRight className="size-3.5" />
          </Link>
        </div>

        <div className="relative mt-12 grid gap-4 lg:mt-8 lg:gap-0">
          {GROUPS.map(({ label, cards }, index) => (
            <div
              key={label}
              aria-hidden={active !== index ? true : undefined}
              className={cn(
                "grid gap-4 md:grid-cols-3 lg:items-start lg:[grid-area:1/1] lg:transition-all lg:duration-700 lg:ease-out motion-reduce:lg:transition-none",
                active === index
                  ? "lg:translate-y-0 lg:opacity-100"
                  : "lg:pointer-events-none lg:translate-y-8 lg:opacity-0",
              )}
            >
              {cards.map((card) => (
                <ShowCard key={card.title} {...card} />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-6 hidden shrink-0 justify-center gap-2 lg:flex" role="tablist">
          {GROUPS.map(({ label }, index) => (
            <button
              key={label}
              type="button"
              role="tab"
              aria-selected={active === index}
              aria-label={label}
              onClick={() => goTo(index)}
              className={cn(
                "h-1.5 rounded-full transition-all duration-500 outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                active === index ? "w-8 bg-primary" : "w-1.5 bg-muted-foreground/40",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
