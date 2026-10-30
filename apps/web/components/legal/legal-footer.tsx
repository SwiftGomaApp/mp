import Image from "next/image";
import Link from "next/link";

import { legalConfig } from "@/lib/legal/config";
import { legalDocuments, legalPath } from "@/lib/legal";
import { siteConfig } from "@/lib/site";

const linkClassName =
  "text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline";

export function LegalFooter() {
  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto grid w-full max-w-6xl gap-10 px-4 py-12 sm:grid-cols-2 sm:px-6 lg:grid-cols-[1.4fr_1fr_1fr]">
        <div className="grid content-start gap-4">
          <Link href="/" className="inline-flex w-fit items-center gap-2.5">
            <Image src={siteConfig.logo} alt="" width={32} height={32} />
            <span className="text-lg font-bold tracking-tight">{siteConfig.shortName}</span>
          </Link>
          <p className="max-w-xs text-sm leading-6 text-muted-foreground">
            La place de marché de Goma : découvrez les boutiques de votre ville, payez en sécurité
            et recevez votre commande chez vous.
          </p>
        </div>

        <nav aria-label="Documents légaux" className="grid content-start gap-3">
          <p className="text-sm font-semibold">Informations légales</p>
          <ul className="grid gap-2">
            {legalDocuments.map((document) => (
              <li key={document.slug}>
                <Link href={legalPath(document.slug)} className={linkClassName}>
                  {document.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="grid content-start gap-3">
          <p className="text-sm font-semibold">Une question ?</p>
          <p className="text-sm leading-6 text-muted-foreground">
            Notre équipe vous répond par e-mail.
          </p>
          <a href={`mailto:${legalConfig.supportEmail}`} className={linkClassName}>
            {legalConfig.supportEmail}
          </a>
        </div>
      </div>

      <div className="border-t">
        <p className="mx-auto w-full max-w-6xl px-4 py-5 text-xs text-muted-foreground sm:px-6">
          © {siteConfig.shortName}. Tous droits réservés. Goma, République démocratique du Congo.
        </p>
      </div>
    </footer>
  );
}
