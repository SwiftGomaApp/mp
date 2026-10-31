"use client";

import { useMemo } from "react";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { helpCategories, helpQuestions, type HelpCategoryId } from "@/lib/help";
import { cn } from "@/lib/utils";

export type HelpFilter = HelpCategoryId | "all";

const normalize = (value: string) => value.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

interface HelpFaqProps {
  filter: HelpFilter;
  onFilterChange: (filter: HelpFilter) => void;
  query: string;
  onReset: () => void;
}

export function HelpFaq({ filter, onFilterChange, query, onReset }: HelpFaqProps) {
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

  return (
    <div className="grid gap-8 lg:grid-cols-[14rem_1fr] lg:gap-16">
      <nav aria-label="Thèmes" className="lg:sticky lg:top-24 lg:self-start">
        <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:overflow-visible lg:px-0">
          {filters.map(({ id, label }) => (
            <li key={id} className="shrink-0">
              <button
                type="button"
                aria-current={filter === id}
                onClick={() => onFilterChange(id)}
                className={cn(
                  "w-full rounded-md px-3 py-1.5 text-left text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:whitespace-normal",
                  filter === id
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {label}
              </button>
            </li>
          ))}
        </ul>
      </nav>

      <div className="min-w-0">
        {results.length > 0 ? (
          <Accordion className="border-y">
            {results.map((item) => (
              <AccordionItem key={item.question} value={item.question}>
                <AccordionTrigger className="py-5 text-base font-medium hover:no-underline">
                  {item.question}
                </AccordionTrigger>
                <AccordionContent className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  {item.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
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
    </div>
  );
}
