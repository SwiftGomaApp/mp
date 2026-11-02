"use client";

import Image from "next/image";
import Link from "next/link";
import { Apple, ArrowLeft, Bike, Check, Play, type LucideIcon } from "lucide-react";

import { AuthSplitLayout } from "@/components/auth/auth-split-layout";
import { LegalImageLinks } from "@/components/auth/legal-links";
import { MOBILE_APP_LINKS } from "@/lib/mobile-app";
import { cn } from "@/lib/utils";

const COPY = {
  "sign-up": {
    title: "Devenez livreur avec l’application",
    text: "Les comptes livreur se créent depuis l’application mobile SwiftGoma. Téléchargez-la pour vous inscrire.",
    back: "Choisir un autre rôle",
  },
  "sign-in": {
    title: "Retrouvez vos courses sur mobile",
    text: "Les comptes livreur s’utilisent depuis l’application mobile SwiftGoma. Téléchargez-la pour vous connecter.",
    back: "Retour à la connexion",
  },
} as const;

const HIGHLIGHTS = [
  "Recevez les demandes de course et confirmez avant de partir",
  "Partagez votre position pendant la livraison seulement",
  "Scannez le code QR pour confirmer la remise",
] as const;

function StoreButton({
  href,
  icon: Icon,
  caption,
  name,
}: {
  href: string;
  icon: LucideIcon;
  caption: string;
  name: string;
}) {
  const className = cn(
    "flex h-14 items-center gap-3 rounded-xl bg-foreground px-4 text-background shadow-sm transition",
    "outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
  );
  const content = (
    <>
      <Icon className="size-6 shrink-0 fill-current" />
      <span className="grid flex-1 text-left leading-tight">
        <span className="text-[10px] font-medium uppercase opacity-70">{caption}</span>
        <span className="text-base font-semibold tracking-tight">{name}</span>
      </span>
    </>
  );

  if (!href) {
    return (
      <span aria-disabled="true" className={cn(className, "cursor-not-allowed opacity-50")}>
        {content}
        <span className="rounded-full bg-background/15 px-2 py-0.5 text-[10px] font-medium">
          Bientôt
        </span>
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(className, "hover:-translate-y-0.5 hover:shadow-md active:translate-y-0")}
    >
      {content}
    </a>
  );
}

export function RiderMobileApp({
  context,
  onBack,
}: {
  context: keyof typeof COPY;
  onBack: () => void;
}) {
  const copy = COPY[context];

  return (
    <AuthSplitLayout imageFooter={<LegalImageLinks />}>
      <div className="flex w-full max-w-sm animate-in flex-col items-center gap-6 fade-in slide-in-from-bottom-2">
        <Link
          href="/"
          aria-label="Retour à l’accueil SwiftGoma"
          className="rounded-lg outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <Image src="/logo-icon.png" alt="SwiftGoma" width={44} height={44} priority />
        </Link>

        <div className="relative w-full overflow-hidden rounded-3xl bg-primary/5 px-6 pt-6 ring-1 ring-primary/10">
          <div className="absolute -top-10 -right-10 size-36 rounded-full bg-primary/10 blur-2xl" />
          <Image
            src="/undraw_on-the-way_zwi3.svg"
            alt=""
            width={320}
            height={220}
            priority
            className="relative mx-auto h-auto w-full max-w-60"
          />
          <span className="relative -mb-3.5 flex w-fit translate-y-1/2 items-center gap-1.5 rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-sm">
            <Bike className="size-3.5" />
            Application livreur
          </span>
        </div>

        <div className="mt-2 flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-bold tracking-tight text-balance">{copy.title}</h1>
          <p className="text-xs text-muted-foreground text-pretty">{copy.text}</p>
        </div>

        <div className="grid w-full gap-2.5">
          <StoreButton
            href={MOBILE_APP_LINKS.playStore}
            icon={Play}
            caption="Disponible sur"
            name="Google Play"
          />
          <StoreButton
            href={MOBILE_APP_LINKS.appStore}
            icon={Apple}
            caption="Télécharger dans"
            name="l’App Store"
          />
        </div>

        <ul className="grid w-full gap-2.5 rounded-2xl border bg-card p-4">
          {HIGHLIGHTS.map((item) => (
            <li key={item} className="flex items-start gap-2.5 text-xs text-muted-foreground">
              <span className="mt-px flex size-4 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Check className="size-3" strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-medium text-foreground/80 underline-offset-4 transition-colors outline-none hover:text-foreground hover:underline focus-visible:underline"
        >
          <ArrowLeft className="size-3.5" />
          {copy.back}
        </button>
      </div>
    </AuthSplitLayout>
  );
}
