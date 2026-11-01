"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { helpCategories, helpQuestions, type HelpCategoryId } from "@/lib/help";
import { cn } from "@/lib/utils";

export type HelpFilter = HelpCategoryId | "all";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

const pad = (value: number) => String(value).padStart(2, "0");

interface HelpFaqProps {
  filter: HelpFilter;
  onFilterChange: (filter: HelpFilter) => void;
  query: string;
  onReset: () => void;
}

/** Themes on top, then the questions on one side and the chosen answer on the other. */
export function HelpFaq({ filter, onFilterChange, query, onReset }: HelpFaqProps) {
  const [selected, setSelected] = useState<string | null>(null);

  const results = useMemo(() => {
    const needle = normalize(query.trim());
    return helpQuestions.filter(
      (item) =>
        (filter === "all" || item.category === filter) &&
        (!needle || normalize(`${item.question} ${item.answer}`).includes(needle)),
    );
  }, [filter, query]);

  const filters: { id: HelpFilter; label: string }[] = [
    { id: "all", label: "Toutes les questions" },
    ...helpCategories.map(({ id, label }) => ({ id, label })),
  ];

  // The selection survives a new search only if the question is still listed.
  const found = results.findIndex((item) => item.question === selected);
  const active = found === -1 ? 0 : found;
  const current = results[active];

  return (
    <div className="grid grid-cols-1 gap-8">
      <nav aria-label="Thèmes">
        <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:px-0 [&::-webkit-scrollbar]:hidden">
          {filters.map(({ id, label }) => (
            <li key={id} className="shrink-0">
              <button
                type="button"
                aria-current={filter === id}
                onClick={() => onFilterChange(id)}
                className={cn(
                  "cursor-pointer rounded-full border px-4 py-1.5 text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  filter === id
                    ? "border-foreground bg-foreground text-background"
                    : "text-muted-foreground hover:border-foreground/40 hover:text-foreground",
                )}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      {current ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12">
          <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:gap-0 lg:divide-y lg:overflow-visible lg:border-y lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
            {results.map(({ question }, index) => (
              <li key={question} className="shrink-0">
                <button
                  type="button"
                  aria-pressed={active === index}
                  onClick={() => setSelected(question)}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-full border px-4 py-2 text-left text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:rounded-none lg:border-0 lg:py-4 lg:whitespace-normal",
                    active === index
                      ? "border-foreground/30 bg-card font-medium text-foreground"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    className={cn(
                      "text-xs tabular-nums transition-colors",
                      active === index ? "text-primary" : "text-muted-foreground/60",
                    )}
                  >
                    {pad(index + 1)}
                  </span>
                  {question}
                </button>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border bg-card p-6 sm:p-8 lg:sticky lg:top-24 lg:self-start">
            <div
              key={current.question}
              aria-live="polite"
              className="animate-in duration-500 fade-in slide-in-from-right-3 motion-reduce:animate-none"
            >
              <p className="text-xs text-muted-foreground tabular-nums">
                Question {pad(active + 1)} / {pad(results.length)}
              </p>
              <h3 className="mt-3 text-xl font-semibold tracking-tight text-balance">
                {current.question}
              </h3>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{current.answer}</p>
            </div>

            <div className="mt-8 flex items-center justify-between border-t pt-4">
              <button
                type="button"
                disabled={active === 0}
                onClick={() => setSelected(results[active - 1].question)}
                className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="size-4" />
                Précédente
              </button>
              <button
                type="button"
                disabled={active === results.length - 1}
                onClick={() => setSelected(results[active + 1].question)}
                className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                Suivante
                <ChevronRight className="size-4" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-y py-12">
          <p className="font-medium">Aucune question ne correspond à votre recherche.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Essayez d’autres mots, ou{" "}
            <a href="#contact" className="text-foreground underline underline-offset-4">
              écrivez-nous
            </a>
            .{" "}
            <button
              type="button"
              onClick={onReset}
              className="text-foreground underline underline-offset-4"
            >
              Réinitialiser
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
