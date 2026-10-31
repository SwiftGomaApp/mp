"use client";

import { useState } from "react";
import { Search } from "lucide-react";

import { HelpFaq, type HelpFilter } from "@/components/help/help-faq";

const POPULAR = [
  { label: "Code de vérification", query: "code" },
  { label: "Mot de passe oublié", query: "mot de passe" },
  { label: "Paiement", query: "paiement" },
  { label: "Remboursement", query: "rembours" },
];

/** The search and the FAQ share one state. */
export function HelpCenter() {
  const [filter, setFilter] = useState<HelpFilter>("all");
  const [query, setQuery] = useState("");

  function search(value: string) {
    setQuery(value);
    if (value) setFilter("all");
  }

  return (
    <>
      <section className="mx-auto w-full max-w-6xl px-4 pt-16 pb-14 sm:px-6 sm:pt-24">
        <p className="mb-4 text-sm font-medium text-primary">Centre d’aide</p>
        <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          Comment pouvons-nous vous aider ?
        </h1>

        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" });
          }}
          className="relative mt-8 max-w-xl"
        >
          <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={query}
            onChange={(event) => search(event.target.value)}
            placeholder="Rechercher dans l’aide"
            aria-label="Rechercher dans l’aide"
            className="h-12 w-full rounded-lg border bg-background pr-4 pl-10 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
        </form>

        <p className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span>Souvent recherché :</span>
          {POPULAR.map(({ label, query: value }) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                search(value);
                document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="text-foreground underline-offset-4 hover:underline"
            >
              {label}
            </button>
          ))}
        </p>
      </section>

      <section
        id="faq"
        className="mx-auto w-full max-w-6xl scroll-mt-20 px-4 pb-20 sm:px-6"
        aria-labelledby="faq-title"
      >
        <h2 id="faq-title" className="mb-8 text-2xl font-bold tracking-tight">
          Questions fréquentes
        </h2>
        <HelpFaq
          filter={filter}
          onFilterChange={setFilter}
          query={query}
          onReset={() => {
            setQuery("");
            setFilter("all");
          }}
        />
      </section>
    </>
  );
}
