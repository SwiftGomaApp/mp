"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { RotateCw, TriangleAlert } from "lucide-react";

import { Logo } from "@/components/global/logo";

const links = [
  { href: "/", label: "Accueil" },
  { href: "/help", label: "Aide" },
  { href: "/contact", label: "Contacter le support" },
] as const;

const MAGNET_RADIUS = 140;

export default function Error({ error, retry }: { error: unknown; retry: () => void }) {
  const root = useRef<HTMLElement>(null);
  const glow = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const rings = useRef<HTMLDivElement>(null);

  useEffect(() => {
    console.error(error);
  }, [error]);

  useEffect(() => {
    const element = root.current;
    const light = glow.current;
    const face = badge.current;
    const action = button.current;
    const layer = rings.current;
    if (!element || !light || !face || !action || !layer) return;
    if (!window.matchMedia("(prefers-reduced-motion: no-preference)").matches) return;

    const hover = window.matchMedia("(pointer: fine)").matches;

    const reset = () => {
      light.style.opacity = "0";
      face.style.transform = "";
      action.style.transform = "";
    };

    const onMove = (event: PointerEvent) => {
      if (!hover) return;
      const rect = element.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      light.style.opacity = "1";
      light.style.transform = `translate3d(${x}px, ${y}px, 0)`;

      const tiltX = (x / rect.width - 0.5) * 2;
      const tiltY = (y / rect.height - 0.5) * 2;
      face.style.transform = `perspective(500px) rotateY(${(tiltX * 28).toFixed(1)}deg) rotateX(${(-tiltY * 28).toFixed(1)}deg)`;

      const box = action.getBoundingClientRect();
      const dx = event.clientX - (box.left + box.width / 2);
      const dy = event.clientY - (box.top + box.height / 2);
      action.style.transform =
        Math.hypot(dx, dy) < MAGNET_RADIUS
          ? `translate3d(${(dx * 0.3).toFixed(1)}px, ${(dy * 0.3).toFixed(1)}px, 0)`
          : "";
    };

    const onDown = (event: PointerEvent) => {
      if ((event.target as HTMLElement).closest("a, button")) return;
      const rect = element.getBoundingClientRect();
      [0, 160].forEach((delay) => {
        const ring = document.createElement("span");
        ring.className = "absolute size-6 rounded-full border-2 border-primary";
        ring.style.left = `${event.clientX - rect.left}px`;
        ring.style.top = `${event.clientY - rect.top}px`;
        layer.appendChild(ring);
        const animation = ring.animate(
          [
            { transform: "translate(-50%, -50%) scale(1)", opacity: 0.55 },
            { transform: "translate(-50%, -50%) scale(14)", opacity: 0 },
          ],
          { duration: 1100, delay, easing: "ease-out", fill: "backwards" },
        );
        animation.onfinish = () => ring.remove();
      });
    };

    element.addEventListener("pointermove", onMove);
    element.addEventListener("pointerleave", reset);
    element.addEventListener("pointerdown", onDown);
    return () => {
      element.removeEventListener("pointermove", onMove);
      element.removeEventListener("pointerleave", reset);
      element.removeEventListener("pointerdown", onDown);
    };
  }, []);

  const digest = (error as { digest?: string } | null)?.digest;

  return (
    <main ref={root} className="relative flex min-h-svh flex-col overflow-hidden">
      <div
        ref={glow}
        aria-hidden
        style={{ opacity: 0 }}
        className="pointer-events-none absolute top-0 left-0 size-[28rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl transition-[opacity,transform] duration-500 ease-out"
      />
      <div
        ref={rings}
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      />

      <header className="relative z-10 flex items-center justify-between px-6 py-6 sm:px-10">
        <Link href="/" aria-label="Accueil SwiftGoma" className="outline-none">
          <Logo size="md" />
        </Link>
        <Link
          href="/contact"
          className="text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
        >
          Besoin d’aide ?
        </Link>
      </header>

      <div className="relative flex flex-1 items-center justify-center px-6 py-12">
        <p
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[min(55vw,60vh)] leading-none font-bold tracking-tighter text-foreground/[0.06] select-none"
        >
          500
        </p>

        <div className="relative z-10 flex max-w-xl flex-col items-center text-center">
          <span
            ref={badge}
            className="flex size-16 animate-in items-center justify-center rounded-full border bg-card shadow-sm transition-transform duration-200 ease-out zoom-in-50 fade-in motion-reduce:animate-none"
          >
            <TriangleAlert className="size-7 text-primary" />
          </span>

          <div className="mt-8 grid animate-in gap-3 delay-100 duration-700 fade-in slide-in-from-bottom-3 fill-mode-backwards motion-reduce:animate-none">
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              Quelque chose s’est mal passé.
            </h1>
            <p className="mx-auto max-w-md leading-7 text-muted-foreground">
              Ce n’est pas de votre faute. Nos services ne répondent peut-être pas pour l’instant.
              Réessayez dans un instant, et si le problème revient, écrivez-nous.
            </p>
          </div>

          <button
            ref={button}
            type="button"
            onClick={() => retry()}
            className="mt-8 inline-flex h-12 cursor-pointer items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground transition-[transform,opacity] duration-200 ease-out outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            <RotateCw className="size-4" />
            Réessayer
          </button>

          {digest && (
            <p className="mt-8 text-xs text-muted-foreground">
              Code de l’erreur à nous donner : <span className="font-mono">{digest}</span>
            </p>
          )}
        </div>
      </div>

      <nav
        aria-label="Pages utiles"
        className="relative z-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-6 text-sm text-muted-foreground"
      >
        {links.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>
    </main>
  );
}
