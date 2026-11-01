"use client";

import { useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

interface Milestone {
  year: string;
  title: string;
  text: string;
}

const STEP_MS = 900;

export function AboutTimeline({ milestones }: { milestones: readonly Milestone[] }) {
  const ref = useRef<HTMLOListElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setShown(true);
        observer.disconnect();
      },
      { threshold: 0.3 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <ol ref={ref} className="mt-14 grid md:grid-cols-3">
      {milestones.map(({ year, title, text }, index) => {
        const upcoming = index === milestones.length - 1;
        const delay = index * STEP_MS;

        return (
          <li key={year} className="group relative pb-12 pl-8 last:pb-0 md:pr-8 md:pb-0 md:pl-0">
            <span
              aria-hidden
              style={{ transitionDelay: `${delay + 250}ms` }}
              className={cn(
                "absolute top-0 bottom-0 left-0 w-px transition-[clip-path] duration-700 ease-in-out motion-reduce:transition-none md:right-0 md:bottom-auto md:h-px md:w-auto",
                upcoming
                  ? "bg-[repeating-linear-gradient(to_bottom,var(--border)_0_6px,transparent_6px_12px)] md:bg-[repeating-linear-gradient(to_right,var(--border)_0_6px,transparent_6px_12px)]"
                  : "bg-primary",
                shown
                  ? "[clip-path:inset(0)]"
                  : "[clip-path:inset(0_0_100%_0)] md:[clip-path:inset(0_100%_0_0)]",
              )}
            />

            <span
              aria-hidden
              style={{ transitionDelay: `${delay}ms` }}
              className={cn(
                "absolute top-0 left-[-0.45rem] flex size-3.5 transition-transform duration-500 ease-out motion-reduce:transition-none md:top-[-0.45rem] md:left-0",
                shown ? "scale-100" : "scale-0",
              )}
            >
              {upcoming && shown && (
                <span className="absolute inset-0 animate-ping rounded-full bg-primary opacity-40 motion-reduce:animate-none" />
              )}
              <span
                className={cn(
                  "relative size-3.5 rounded-full border-2 border-primary transition-colors duration-500",
                  upcoming ? "bg-background" : "bg-primary group-hover:bg-background",
                )}
              />
            </span>

            <div
              style={{ transitionDelay: `${delay + 150}ms` }}
              className={cn(
                "transition-all duration-700 ease-out motion-reduce:transition-none md:pt-8",
                shown ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0",
              )}
            >
              <p
                aria-hidden
                className="text-5xl font-bold tracking-tight text-foreground/10 tabular-nums transition-colors duration-500 group-hover:text-primary sm:text-6xl"
              >
                {year}
              </p>
              <h3 className="mt-4 text-lg font-semibold">
                <span className="sr-only">{year} : </span>
                {title}
              </h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{text}</p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
