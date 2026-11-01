import Link from "next/link";
import { MapPin, Mail, MessageCircle, Phone, ShieldCheck } from "lucide-react";

import { Logo } from "@/components/global/logo";
import { NewsletterForm } from "@/components/global/newsletter-form";
import { ThemePicker } from "@/components/global/theme-picker";
import { legalDocuments, legalPath } from "@/lib/legal";
import { legalConfig } from "@/lib/legal/config";
import { contactConfig, siteConfig, socialLinks } from "@/lib/site";
import { cn } from "@/lib/utils";

const linkClassName =
  "text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline";

const EXPLORE_LINKS = [
  { href: "/shops", label: "Boutiques" },
  { href: "/categories", label: "Catégories" },
  { href: "/sell", label: "Vendre sur SwiftGoma" },
  { href: "/deliver", label: "Devenir livreur" },
] as const;

const ACCOUNT_LINKS = [
  { href: "/profile", label: "Mon profil" },
  { href: "/orders", label: "Mes commandes" },
  { href: "/favorites", label: "Favoris" },
  { href: "/cart", label: "Panier" },
] as const;

const ABOUT_LINKS = [
  { href: "/about", label: "À propos" },
  { href: "/how-it-works", label: "Comment ça marche" },
  { href: "/partners", label: "Devenir partenaire" },
] as const;

const PAYMENT_METHODS = ["M-Pesa", "Airtel Money", "Orange Money", "Carte bancaire"] as const;

const APP_STORES = ["Google Play", "App Store"] as const;

function FooterColumn({
  title,
  children,
  className,
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <nav aria-label={title} className={cn("grid content-start gap-3", className)}>
      <p className="text-sm font-semibold">{title}</p>
      <ul className="grid gap-2">{children}</ul>
    </nav>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 py-14 sm:px-6 xl:grid-cols-[1.1fr_2fr] xl:gap-14">
        <div className="grid max-w-md content-start gap-8">
          <div className="grid gap-4">
            <Link href="/" aria-label="Accueil SwiftGoma" className="w-fit">
              <Logo size="md" />
            </Link>
            <p className="max-w-sm text-sm leading-6 text-muted-foreground">
              La place de marché de Goma : découvrez les boutiques de votre ville, payez en sécurité
              et recevez votre commande chez vous.
            </p>
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <MapPin className="size-4 shrink-0" />
              Goma, Nord-Kivu, République démocratique du Congo
            </p>
          </div>
        </div>

        <div className="grid gap-10 sm:grid-cols-3 xl:grid-cols-4 xl:gap-8">
          <FooterColumn title="Explorer">
            {EXPLORE_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className={linkClassName}>
                  {label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Mon compte">
            {ACCOUNT_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className={linkClassName}>
                  {label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="SwiftGoma">
            {ABOUT_LINKS.map(({ href, label }) => (
              <li key={href}>
                <Link href={href} className={linkClassName}>
                  {label}
                </Link>
              </li>
            ))}
          </FooterColumn>

          <FooterColumn title="Support">
            <li>
              <Link href="/help" className={linkClassName}>
                Centre d’aide
              </Link>
            </li>
            <li>
              <Link href="/contact" className={linkClassName}>
                Contacter le Support
              </Link>
            </li>
            <li>
              <a
                href={contactConfig.phoneHref}
                className={cn(linkClassName, "flex items-center gap-2 whitespace-nowrap")}
              >
                <Phone className="size-3.5 shrink-0" />
                {contactConfig.phone}
              </a>
            </li>
            <li>
              <a
                href={contactConfig.whatsappHref}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(linkClassName, "flex items-center gap-2")}
              >
                <MessageCircle className="size-3.5 shrink-0" />
                WhatsApp
              </a>
            </li>
            <li>
              <a
                href={`mailto:${legalConfig.supportEmail}`}
                className={cn(linkClassName, "flex items-center gap-2 whitespace-nowrap")}
              >
                <Mail className="size-3.5 shrink-0" />
                {legalConfig.supportEmail}
              </a>
            </li>
          </FooterColumn>
        </div>
      </div>

      <div>
        <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 sm:px-6 md:grid-cols-2 md:items-start">
          <div className="grid gap-3">
            <p className="text-sm font-semibold">Suivez-nous</p>
            <ul className="flex flex-wrap gap-x-5 gap-y-2">
              {socialLinks.map(({ id, label, href }) => (
                <li key={id}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={linkClassName}
                  >
                    {label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-3 md:max-w-md md:justify-self-end md:w-full">
            <p className="text-sm font-semibold">Restez informé</p>
            <NewsletterForm />
          </div>
        </div>
      </div>

      <div className="border-t">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 py-6 sm:px-6 md:grid-cols-2 md:items-center">
          <div className="grid gap-2">
            <p className="flex items-center gap-2 text-xs font-medium">
              <ShieldCheck className="size-4 shrink-0" />
              Paiement sécurisé : votre argent est retenu jusqu’à la remise par code QR
            </p>
            <ul className="flex flex-wrap gap-2" aria-label="Moyens de paiement acceptés">
              {PAYMENT_METHODS.map((method) => (
                <li
                  key={method}
                  className="rounded-md border px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {method}
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-2 md:justify-items-end">
            <p className="text-xs font-medium">Application mobile</p>
            <ul className="flex flex-wrap gap-2" aria-label="Télécharger l’application">
              {APP_STORES.map((store) => (
                <li
                  key={store}
                  className="flex items-center gap-2 rounded-md border border-dashed px-3 py-1.5 text-xs text-muted-foreground"
                >
                  <span className="font-medium text-foreground">{store}</span>
                  <span>Bientôt disponible</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t">
        <nav
          aria-label="Informations légales"
          className="mx-auto flex w-full max-w-7xl flex-wrap justify-center gap-x-6 gap-y-2 px-4 pt-5 sm:px-6"
        >
          {legalDocuments.map((document) => (
            <Link
              key={document.slug}
              href={legalPath(document.slug)}
              className="text-xs text-muted-foreground underline-offset-4 transition-colors hover:text-foreground hover:underline"
            >
              {document.title}
            </Link>
          ))}
        </nav>
        <div className="mx-auto flex w-full max-w-7xl flex-col items-start justify-between gap-4 px-4 py-5 sm:flex-row sm:items-center sm:px-6">
          <p className="text-xs text-muted-foreground">
            © {siteConfig.launchYear} {siteConfig.shortName}. Tous droits réservés.
          </p>
          <ThemePicker />
        </div>
      </div>
    </footer>
  );
}
