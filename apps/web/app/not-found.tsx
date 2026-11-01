import Link from "next/link";
import { ArrowRight, MapPinOff } from "lucide-react";

import { Logo } from "@/components/global/logo";

import { CursorField } from "@/components/global/cursor-field";
import { RoutesBackdrop } from "@/components/global/routes-backdrop";

const suggestions = [
  { href: "/how-it-works", label: "Comment ça marche" },
  { href: "/sell", label: "Vendre" },
  { href: "/deliver", label: "Livrer" },
  { href: "/help", label: "Aide" },
] as const;

export default function NotFound() {
  return (
    <CursorField
      style={{
        backgroundImage:
          "radial-gradient(color-mix(in oklab, var(--foreground) 18%, transparent) 1px, transparent 1px)",
        backgroundSize: "20px 20px",
      }}
      className="relative flex min-h-svh flex-col overflow-hidden"
    >
      <div className="pointer-events-none absolute -inset-8 [translate:calc(var(--px)*-10px)_calc(var(--py)*-10px)]">
        <RoutesBackdrop className="size-full text-foreground mask-[radial-gradient(ellipse_at_center,transparent_22%,black_72%)]" />
      </div>

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
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 [translate:calc(var(--px)*-26px)_calc(var(--py)*-26px)]"
        >
          <p className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[min(55vw,60vh)] leading-none font-bold tracking-tighter text-foreground/6 select-none">
            404
          </p>
        </div>

        <div className="relative z-10 flex max-w-xl flex-col items-center text-center [translate:calc(var(--px)*10px)_calc(var(--py)*10px)]">
          <span className="flex size-16 animate-bounce items-center justify-center rounded-full border bg-card shadow-sm animation-duration-[2.4s] motion-reduce:animate-none">
            <MapPinOff className="size-7 text-primary" />
          </span>
          <span aria-hidden className="mt-2 h-1.5 w-12 rounded-full bg-foreground/15 blur-[2px]" />

          <div className="mt-8 grid animate-in gap-3 duration-700 fade-in slide-in-from-bottom-3 motion-reduce:animate-none">
            <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
              Cette adresse n’existe pas.
            </h1>
            <p className="mx-auto max-w-md leading-7 text-muted-foreground">
              Le lien est peut-être ancien, ou la page n’est pas encore ouverte. Votre colis, lui,
              ne se perd jamais : c’est la page qui s’est égarée.
            </p>
          </div>

          <Link
            href="/"
            className="group mt-8 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-8 text-sm font-medium text-primary-foreground transition-opacity outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Retour à l’accueil
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" />
          </Link>
        </div>
      </div>

      <nav
        aria-label="Pages utiles"
        className="relative z-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-6 py-6 text-sm text-muted-foreground"
      >
        {suggestions.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className="transition-colors outline-none hover:text-foreground focus-visible:text-foreground"
          >
            {label}
          </Link>
        ))}
      </nav>
    </CursorField>
  );
}
