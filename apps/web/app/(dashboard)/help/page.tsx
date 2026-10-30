import Link from "next/link";
import { Mail } from "lucide-react";

import { legalDocuments, legalPath } from "@/lib/legal";
import { legalConfig } from "@/lib/legal/config";

export default function HelpPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col">
      <header className="border-b px-4 pt-2 pb-4 sm:px-8 md:pt-8">
        <h1 className="text-2xl font-bold tracking-tight">Aide</h1>
      </header>

      <div className="grid gap-6 px-4 py-6 sm:px-8">
        <section className="flex items-start gap-4 rounded-xl border bg-card p-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Mail className="size-5" />
          </span>
          <div className="grid gap-1">
            <h2 className="text-sm font-semibold">Contacter le Support</h2>
            <p className="text-sm text-muted-foreground">
              Une question, un problème avec votre compte ou une commande ? Écrivez-nous.
            </p>
            <a
              href={`mailto:${legalConfig.supportEmail}`}
              className="w-fit text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {legalConfig.supportEmail}
            </a>
          </div>
        </section>

        <section className="grid gap-3">
          <h2 className="text-sm font-semibold">Informations légales</h2>
          <ul className="grid gap-2 text-sm">
            {legalDocuments.map((document) => (
              <li key={document.slug}>
                <Link
                  href={legalPath(document.slug)}
                  className="text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
                >
                  {document.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
