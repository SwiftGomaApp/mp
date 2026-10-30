"use client";

import { useEffect, useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "cn";

interface TocItem {
  id: string;
  title: string;
}

function scrollToSection(event: React.MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (!target) return;

  event.preventDefault();
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

function useActiveSection(items: TocItem[]) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "");

  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((section): section is HTMLElement => section !== null);

    let frame = 0;
    const update = () => {
      frame = 0;
      const atBottom = window.innerHeight + window.scrollY >= document.body.scrollHeight - 4;
      const current = atBottom
        ? sections.at(-1)
        : sections.findLast((section) => section.getBoundingClientRect().top <= 120);
      setActiveId((current ?? sections[0])?.id ?? "");
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [items]);

  return [activeId, setActiveId] as const;
}

/** The sticky "Sur cette page" list shown next to the document on large screens. */
export function LegalToc({ items }: { items: TocItem[] }) {
  const [activeId, setActiveId] = useActiveSection(items);

  return (
    <nav aria-label="Sur cette page" className="sticky top-20 hidden lg:block">
      <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Sur cette page
      </p>
      <ul className="grid gap-0.5 border-l">
        {items.map((item, index) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(event) => {
                scrollToSection(event, item.id);
                setActiveId(item.id);
              }}
              aria-current={activeId === item.id ? "location" : undefined}
              className={cn(
                "-ml-px block border-l py-1.5 pl-4 text-sm leading-5 transition-colors outline-none focus-visible:text-foreground",
                activeId === item.id
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground",
              )}
            >
              {index + 1}. {item.title}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** A collapsible version of the list for phones and tablets. */
export function LegalTocMobile({ items }: { items: TocItem[] }) {
  return (
    <details className="group rounded-lg border bg-card lg:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium [&::-webkit-details-marker]:hidden">
        Sur cette page
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
      </summary>
      <ul className="grid gap-1 border-t px-4 py-3">
        {items.map((item, index) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(event) => {
                scrollToSection(event, item.id);
                event.currentTarget.closest("details")?.removeAttribute("open");
              }}
              className="block py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {index + 1}. {item.title}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}
