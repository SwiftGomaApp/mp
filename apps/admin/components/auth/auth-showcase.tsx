"use client";

import { useState } from "react";

import { cn } from "@/lib/utils";

const SLIDE_DURATION_MS = 6000;

const slides = [
  {
    tab: "Comptes",
    title: "Gérez les comptes SwiftGoma en toute sécurité",
    description:
      "Recherchez un utilisateur, consultez son activité et agissez avec un journal d’audit complet.",
  },
  {
    tab: "Vérifier",
    title: "Validez les vendeurs et les livreurs",
    description:
      "Examinez les dossiers, appelez les demandeurs et donnez votre avis avant la décision finale.",
  },
  {
    tab: "Protéger",
    title: "Chaque action sensible est confirmée",
    description:
      "Les actions irréversibles exigent votre code de confirmation et sont enregistrées dans le journal.",
  },
] as const;

export function AuthShowcase() {
  const [active, setActive] = useState(0);
  const slide = slides[active];

  return (
    <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/50 to-transparent p-6 pt-20 text-white">
      <div
        key={active}
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-1000 motion-safe:ease-out"
      >
        <h2 className="text-xl font-semibold tracking-tight">{slide.title}</h2>
        <p className="mt-2 max-w-md text-xs text-white/85">{slide.description}</p>
      </div>

      <div
        role="tablist"
        aria-label="Ce que vous pouvez faire avec la console SwiftGoma"
        className="mt-5 flex gap-5"
      >
        {slides.map((item, index) => (
          <button
            key={item.tab}
            type="button"
            role="tab"
            aria-selected={index === active}
            onClick={() => setActive(index)}
            className="group flex w-16 flex-col gap-1.5 text-left outline-none"
          >
            <span
              className={cn(
                "text-[0.65rem] font-semibold tracking-wide uppercase transition-colors group-focus-visible:underline",
                index === active ? "text-white" : "text-white/60 group-hover:text-white/90",
              )}
            >
              {item.tab}
            </span>
            <span className="h-1 w-full overflow-hidden rounded-full bg-white/25">
              <span
                key={index === active ? `active-${active}` : "idle"}
                className={cn(
                  "block h-full rounded-full bg-white",
                  index < active && "w-full",
                  index > active && "w-0",
                  index === active && "w-full motion-safe:w-0 motion-safe:animate-progress-fill",
                )}
                style={{ "--slide-duration": `${SLIDE_DURATION_MS}ms` } as React.CSSProperties}
                onAnimationEnd={() => {
                  if (index === active) setActive((current) => (current + 1) % slides.length);
                }}
              />
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
