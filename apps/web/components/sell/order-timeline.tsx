"use client";

import { useEffect, useRef, useState } from "react";
import { Bike, Check, Package, QrCode, ShoppingBag, Wallet } from "lucide-react";

import { cn } from "@/lib/utils";

const STEPS = [
  { icon: ShoppingBag, title: "Commande reçue", detail: "120 $ · 2 articles", time: "14:02" },
  { icon: Check, title: "Vous l’acceptez", detail: "Dans les 15 minutes", time: "14:05" },
  { icon: Package, title: "Prête à remettre", detail: "Colis préparé", time: "14:20" },
  {
    icon: Bike,
    title: "Le livreur la récupère",
    detail: "Patrick M. part avec le colis",
    time: "14:38",
  },
  { icon: QrCode, title: "Remise confirmée", detail: "Le client scanne le code QR", time: "14:52" },
  { icon: Wallet, title: "Votre paiement", detail: "Disponible après 24 heures", time: "+ 24 h" },
] as const;

const STEP_MS = 1500;
const HOLD_TICKS = 3;

export function OrderTimeline({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), {
      threshold: 0.4,
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!inView) return;
    const timer = setInterval(
      () => setTick((value) => (value + 1) % (STEPS.length + HOLD_TICKS + 1)),
      STEP_MS,
    );
    return () => clearInterval(timer);
  }, [inView]);

  const reached = Math.min(tick, STEPS.length);
  const finished = reached === STEPS.length;
  const current = reached > 0 ? STEPS[reached - 1] : null;

  return (
    <div
      ref={ref}
      aria-label="Exemple de suivi d’une commande"
      className={cn(
        "w-full max-w-md rounded-2xl border bg-card p-6 text-card-foreground",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="grid leading-tight">
          <span className="text-sm font-semibold">Commande #1042</span>
          <span className="text-xs text-muted-foreground">Sac en cuir · Aminata K.</span>
        </div>
        <span
          key={current?.title}
          className="animate-in rounded-full bg-muted px-2.5 py-1 text-xs font-medium duration-500 fade-in slide-in-from-bottom-1 motion-reduce:animate-none"
        >
          {finished ? "Terminée" : (current?.title ?? "En attente")}
        </span>
      </div>

      <ol className="relative mt-6 grid gap-0">
        <span aria-hidden className="absolute top-4 bottom-4 left-[0.9rem] w-px bg-border" />
        <span
          aria-hidden
          style={{ transform: `scaleY(${Math.max(0, reached - 1) / (STEPS.length - 1)})` }}
          className="absolute top-4 bottom-4 left-[0.9rem] w-px origin-top bg-primary transition-transform duration-1000 ease-in-out motion-reduce:transition-none"
        />
        {STEPS.map(({ icon: Icon, title, detail, time }, index) => {
          const shown = index < reached;
          const active = index === reached - 1 && !finished;
          return (
            <li
              key={title}
              className={cn(
                "relative flex items-center gap-4 py-2.5 transition-all duration-700 ease-out motion-reduce:transition-none",
                shown ? "translate-x-0 opacity-100" : "translate-x-2 opacity-35",
              )}
            >
              <span className="relative flex size-7 shrink-0">
                {active && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-40 motion-reduce:animate-none" />
                )}
                <span
                  className={cn(
                    "relative flex size-7 items-center justify-center rounded-full border transition-colors duration-700",
                    shown
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-card text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" />
                </span>
              </span>
              <span className="grid flex-1 leading-tight">
                <span className="text-sm font-medium">{title}</span>
                <span className="text-xs text-muted-foreground">{detail}</span>
              </span>
              <span className="text-xs text-muted-foreground tabular-nums">{time}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
