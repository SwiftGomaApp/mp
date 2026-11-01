"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { riderQuestions } from "@/lib/deliver";
import { cn } from "@/lib/utils";

const pad = (value: number) => String(value).padStart(2, "0");

/** Questions on one side, the chosen answer on the other, instead of an accordion. */
export function RiderFaq() {
  const [active, setActive] = useState(0);
  const total = riderQuestions.length;
  const current = riderQuestions[active];

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:gap-12">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-2 [scrollbar-width:none] lg:mx-0 lg:grid lg:gap-0 lg:divide-y lg:overflow-visible lg:border-y lg:px-0 lg:pb-0 [&::-webkit-scrollbar]:hidden">
        {riderQuestions.map(({ question }, index) => (
          <li key={question} className="shrink-0">
            <button
              type="button"
              aria-pressed={active === index}
              onClick={() => setActive(index)}
              className={cn(
                "flex w-full cursor-pointer items-center gap-3 rounded-full border px-4 py-2 text-left text-sm whitespace-nowrap transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:rounded-none lg:border-0 lg:py-4 lg:whitespace-normal",
                active === index
                  ? "border-foreground/30 bg-card font-medium text-foreground lg:bg-card"
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
          key={active}
          aria-live="polite"
          className="animate-in duration-500 fade-in slide-in-from-right-3 motion-reduce:animate-none"
        >
          <p className="text-xs text-muted-foreground tabular-nums">
            Question {pad(active + 1)} / {pad(total)}
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
            onClick={() => setActive((value) => value - 1)}
            className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <ChevronLeft className="size-4" />
            Précédente
          </button>
          <button
            type="button"
            disabled={active === total - 1}
            onClick={() => setActive((value) => value + 1)}
            className="inline-flex cursor-pointer items-center gap-1 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Suivante
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
