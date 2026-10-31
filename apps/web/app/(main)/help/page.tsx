import Link from "next/link";

import { HelpContactForm } from "@/components/help/help-contact-form";
import { HelpCenter } from "@/components/help/help-center";
import { helpGuides, safetyTips } from "@/lib/help";
import { legalDocuments, legalPath } from "@/lib/legal";
import { legalConfig } from "@/lib/legal/config";
import { pageMetadata } from "@/lib/seo";

export const metadata = pageMetadata({
  title: "Centre d’aide",
  description:
    "Questions fréquentes, guides et contact du Support SwiftGoma : compte, commandes, paiement, livraison, vente et livraison.",
  path: "/help",
});

const linkClassName = "text-foreground underline underline-offset-4 hover:text-primary";

export default function HelpPage() {
  return (
    <>
      <HelpCenter />

      <section className="border-t" aria-labelledby="guides">
        <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
          <h2 id="guides" className="text-2xl font-bold tracking-tight">
            Bien démarrer
          </h2>
          <p className="mt-2 text-muted-foreground">
            Selon votre rôle, l’essentiel en quatre étapes.
          </p>

          <div className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {helpGuides.map(({ title, description, steps }) => (
              <article key={title}>
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{description}</p>
                <ol className="mt-5 grid border-t">
                  {steps.map((step, index) => (
                    <li key={step} className="flex gap-4 border-b py-3 text-sm">
                      <span className="w-4 shrink-0 text-muted-foreground tabular-nums">
                        {index + 1}
                      </span>
                      <span>{step}</span>
                    </li>
                  ))}
                </ol>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t" aria-labelledby="safety">
        <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-16 sm:px-6 lg:grid-cols-[14rem_1fr] lg:gap-16">
          <h2 id="safety" className="text-2xl font-bold tracking-tight">
            Restez en sécurité
          </h2>
          <ul className="grid max-w-2xl gap-4">
            {safetyTips.map((tip) => (
              <li key={tip} className="border-l-2 border-foreground/80 pl-4 text-sm leading-6">
                {tip}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="contact" className="scroll-mt-14 border-t" aria-labelledby="contact-title">
        <div className="mx-auto grid w-full max-w-6xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1fr_1.3fr] lg:gap-16">
          <div className="grid content-start gap-8">
            <div>
              <h2 id="contact-title" className="text-2xl font-bold tracking-tight">
                Besoin d’aide ?
              </h2>
              <p className="mt-2 text-muted-foreground">
                Vous n’avez pas trouvé votre réponse ? Écrivez-nous avec le plus de détails
                possible.
              </p>
            </div>

            <dl className="grid gap-5 text-sm">
              <div>
                <dt className="font-semibold">E-mail</dt>
                <dd className="mt-1">
                  <a href={`mailto:${legalConfig.supportEmail}`} className={linkClassName}>
                    {legalConfig.supportEmail}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Délai de réponse</dt>
                <dd className="mt-1 text-muted-foreground">
                  Nous répondons dans les meilleurs délais.
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Compte suspendu</dt>
                <dd className="mt-1">
                  <Link href="/auth/support" className={linkClassName}>
                    Contacter le Support sans vous connecter
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="font-semibold">Informations légales</dt>
                <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  {legalDocuments.map((document) => (
                    <Link
                      key={document.slug}
                      href={legalPath(document.slug)}
                      className="underline-offset-4 hover:text-foreground hover:underline"
                    >
                      {document.title}
                    </Link>
                  ))}
                </dd>
              </div>
            </dl>
          </div>

          <HelpContactForm />
        </div>
      </section>
    </>
  );
}
