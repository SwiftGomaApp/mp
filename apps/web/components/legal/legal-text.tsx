import Link from "next/link";
import { Info } from "lucide-react";

import type { LegalBlock } from "@/lib/legal/types";

const INLINE_PATTERN = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\)|`[^`]+`)/g;
const LINK_LABEL_PATTERN = /^\[([^\]]+)\]\(([^)]+)\)$/;

const linkClassName =
  "font-medium text-primary underline underline-offset-4 transition-colors hover:text-primary/80";

/** Renders `**bold**`, `` `code` `` and `[label](href)` inside a legal text. */
export function LegalInline({ text }: { text: string }) {
  return text.split(INLINE_PATTERN).map((part, index) => {
    if (!part) return null;

    if (part.startsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("`")) {
      return (
        <code key={index} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    }

    const link = LINK_LABEL_PATTERN.exec(part);
    if (link) {
      const [, label, href] = link;
      return href.startsWith("/") ? (
        <Link key={index} href={href} className={linkClassName}>
          {label}
        </Link>
      ) : (
        <a key={index} href={href} className={linkClassName}>
          {label}
        </a>
      );
    }

    return part;
  });
}

export function LegalBlockView({ block }: { block: LegalBlock }) {
  if (typeof block === "string") {
    return (
      <p className="text-[15px] leading-7 text-foreground/85">
        <LegalInline text={block} />
      </p>
    );
  }

  if ("heading" in block) {
    return <h3 className="pt-2 text-base font-semibold text-foreground">{block.heading}</h3>;
  }

  if ("list" in block) {
    return (
      <ul className="grid list-disc gap-2 pl-5 text-[15px] leading-7 text-foreground/85 marker:text-primary">
        {block.list.map((item, index) => (
          <li key={index} className="pl-1">
            <LegalInline text={item} />
          </li>
        ))}
      </ul>
    );
  }

  if ("steps" in block) {
    return (
      <ol className="grid list-decimal gap-2 pl-5 text-[15px] leading-7 text-foreground/85 marker:font-semibold marker:text-primary">
        {block.steps.map((item, index) => (
          <li key={index} className="pl-1">
            <LegalInline text={item} />
          </li>
        ))}
      </ol>
    );
  }

  if ("note" in block) {
    return (
      <aside className="flex gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4 text-sm leading-6 text-foreground/90">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
        <p>
          <LegalInline text={block.note} />
        </p>
      </aside>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full min-w-120 border-collapse text-left text-sm">
        <thead className="bg-muted/60">
          <tr>
            {block.table.head.map((cell) => (
              <th key={cell} scope="col" className="px-4 py-2.5 font-semibold text-foreground">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.table.rows.map((row, rowIndex) => (
            <tr key={rowIndex} className="border-t align-top">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-4 py-3 leading-6 text-foreground/85">
                  <LegalInline text={cell} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
