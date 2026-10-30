import { Clock } from "lucide-react";

import { LegalBlockView, LegalInline } from "@/components/legal/legal-text";
import { LegalToc, LegalTocMobile } from "@/components/legal/legal-toc";
import type { LegalDocument } from "@/lib/legal/types";

const dateFormatter = new Intl.DateTimeFormat("fr-FR", { dateStyle: "long", timeZone: "UTC" });

export function LegalDocumentView({ document }: { document: LegalDocument }) {
  const items = document.sections.map(({ id, title }) => ({ id, title }));
  const lastUpdated = dateFormatter.format(new Date(`${document.lastUpdated}T00:00:00Z`));

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_15rem] lg:gap-16">
      <article className="min-w-0">
        <header className="grid gap-4 border-b pb-8">
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            {document.title}
          </h1>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
            <Clock className="size-4" aria-hidden="true" />
            <span>
              Dernière mise à jour : <time dateTime={document.lastUpdated}>{lastUpdated}</time>
            </span>
            <span aria-hidden="true">·</span>
            <span>Version {document.version}</span>
          </p>
          <p className="max-w-prose text-base leading-7 text-foreground/85">
            <LegalInline text={document.intro} />
          </p>
        </header>

        <div className="mt-8 lg:hidden">
          <LegalTocMobile items={items} />
        </div>

        <div className="mt-8 grid gap-12">
          {document.sections.map((section, index) => (
            <section key={section.id} id={section.id} className="grid scroll-mt-24 gap-4">
              <h2 className="text-xl font-semibold tracking-tight">
                <span className="mr-2 text-primary">{index + 1}.</span>
                {section.title}
              </h2>
              {section.blocks.map((block, blockIndex) => (
                <LegalBlockView key={blockIndex} block={block} />
              ))}
            </section>
          ))}
        </div>
      </article>

      <aside>
        <LegalToc items={items} />
      </aside>
    </div>
  );
}
