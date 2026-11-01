"use client";

import { useEffect, useState } from "react";

import {
  OrderMock,
  RiderMock,
  RiderRequestMock,
  ShopMock,
  WalletMock,
} from "@/components/sell/mocks";
import { cn } from "@/lib/utils";

const AUTO_ADVANCE_MS = 7000;

const TABS = [
  {
    id: "shop",
    label: "Boutique",
    caption:
      "Publiez vos produits avec photos, prix et stock. Vos prix, dans la monnaie de votre choix.",
    mock: <ShopMock className="max-w-sm" />,
  },
  {
    id: "orders",
    label: "Commandes",
    caption: "Chaque commande arrive sur votre téléphone. Vous avez 15 minutes pour l’accepter.",
    mock: <OrderMock className="max-w-sm" />,
  },
  {
    id: "delivery",
    label: "Livraison",
    caption:
      "Choisissez l’un des livreurs vérifiés reliés à votre boutique, ou proposez le retrait.",
    mock: <RiderMock className="max-w-sm" />,
  },
  {
    id: "team",
    label: "Équipe",
    caption:
      "Un livreur demande à rejoindre votre boutique : vous acceptez ou refusez, et vous pouvez le retirer à tout moment.",
    mock: <RiderRequestMock className="max-w-sm" />,
  },
  {
    id: "wallet",
    label: "Portefeuille",
    caption: "Vos ventes arrivent dans votre portefeuille. Retirez-les sur votre Mobile Money.",
    mock: <WalletMock className="max-w-sm" />,
  },
] as const;

export function HeroDemo() {
  const [active, setActive] = useState(0);
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;
    const timer = setTimeout(
      () => setActive((index) => (index + 1) % TABS.length),
      AUTO_ADVANCE_MS,
    );
    return () => clearTimeout(timer);
  }, [auto, active]);

  const tab = TABS[active];

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div
        role="tablist"
        aria-label="Aperçu de l’application vendeur"
        className="grid grid-cols-2 gap-1 p-1.5 sm:grid-cols-5"
      >
        {TABS.map(({ id, label }, index) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`demo-tab-${id}`}
            aria-selected={active === index}
            aria-controls="demo-panel"
            onClick={() => {
              setActive(index);
              setAuto(false);
            }}
            className={cn(
              "relative flex items-center justify-center gap-2 overflow-hidden rounded-lg px-3 py-2.5 text-sm transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
              active === index
                ? "bg-muted font-medium text-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <span
              className={cn(
                "size-1.5 rounded-full border transition-colors",
                active === index ? "border-primary bg-primary" : "border-muted-foreground/60",
              )}
            />
            {label}
            {active === index && auto && (
              <span
                key={id}
                aria-hidden
                style={{ "--slide-duration": `${AUTO_ADVANCE_MS}ms` } as React.CSSProperties}
                className="absolute inset-x-0 bottom-0 h-0.5 w-0 animate-progress-fill bg-primary motion-reduce:hidden"
              />
            )}
          </button>
        ))}
      </div>

      <div
        id="demo-panel"
        role="tabpanel"
        aria-labelledby={`demo-tab-${tab.id}`}
        className="grid min-h-104 place-items-center border-t bg-muted/30 px-4 py-12"
      >
        <div
          key={tab.id}
          className="grid w-full justify-items-center gap-8 animate-in fade-in slide-in-from-bottom-3 duration-500 motion-reduce:animate-none"
        >
          {tab.mock}
          <p className="max-w-md text-center text-sm leading-6 text-muted-foreground">
            {tab.caption}
          </p>
        </div>
      </div>
    </div>
  );
}
