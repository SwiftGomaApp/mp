import Link from "next/link";
import { ArrowUpRight, Mail, MessageCircle, Phone, ShieldAlert } from "lucide-react";

import { Reveal } from "@/components/global/reveal";
import { SupportForm } from "@/components/contact/support-form";
import { legalConfig } from "@/lib/legal/config";
import { pageMetadata } from "@/lib/seo";
import { contactConfig } from "@/lib/site";

export const metadata = pageMetadata({
  title: "Contacter le Support",
  description:
    "Écrivez, appelez ou envoyez un message WhatsApp à l’équipe SwiftGoma pour un problème de compte, de commande, de paiement ou de livraison.",
  path: "/contact",
});

const channels = [
  {
    icon: Mail,
    label: "E-mail",
    value: legalConfig.supportEmail,
    href: `mailto:${legalConfig.supportEmail}`,
    hint: "Idéal pour un dossier détaillé",
  },
  {
    icon: Phone,
    label: "Téléphone",
    value: contactConfig.phone,
    href: contactConfig.phoneHref,
    hint: "Pour parler à quelqu’un",
  },
  {
    icon: MessageCircle,
    label: "WhatsApp",
    value: contactConfig.phone,
    href: contactConfig.whatsappHref,
    hint: "Un message, une photo, une capture",
    external: true,
  },
] as const;

const linkClassName = "text-foreground underline underline-offset-4 hover:text-primary";

export default function ContactPage() {
  return (
    <div>
      <section className="mx-auto w-full max-w-6xl px-4 pt-20 pb-12 sm:px-6 sm:pt-28">
        <Reveal className="grid max-w-3xl gap-6">
          <p className="text-sm font-medium text-primary">Contacter le Support</p>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-6xl">
            Une vraie personne vous répond.
          </h1>
          <p className="max-w-2xl text-lg leading-8 text-muted-foreground">
            Un souci avec un compte, une commande, un paiement ou une livraison ? Choisissez le
            moyen qui vous convient. Une réponse rapide se trouve peut-être déjà dans le{" "}
            <Link href="/help" className={linkClassName}>
              centre d’aide
            </Link>
            .
          </p>
        </Reveal>
      </section>

      <section className="mx-auto grid w-full max-w-6xl gap-10 px-4 pb-24 sm:px-6 lg:grid-cols-[1fr_1.4fr] lg:gap-14">
        <div className="grid content-start gap-4">
          <ul className="grid gap-3">
            {channels.map(({ icon: Icon, label, value, href, hint, ...rest }, index) => (
              <Reveal key={label} delay={index * 100}>
                <li className="list-none">
                  <a
                    href={href}
                    {...("external" in rest
                      ? { target: "_blank", rel: "noopener noreferrer" }
                      : {})}
                    className="group flex items-center gap-4 rounded-2xl border bg-card p-5 outline-none transition-colors hover:border-foreground/30 focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-muted transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <Icon className="size-5" />
                    </span>
                    <span className="grid min-w-0 flex-1 leading-tight">
                      <span className="text-xs text-muted-foreground">{label}</span>
                      <span className="mt-1 truncate font-medium">{value}</span>
                      <span className="mt-1 text-xs text-muted-foreground">{hint}</span>
                    </span>
                    <ArrowUpRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 motion-reduce:transition-none" />
                  </a>
                </li>
              </Reveal>
            ))}
          </ul>

          <Reveal delay={300}>
            <div className="flex gap-3 rounded-2xl border border-dashed p-5 text-sm leading-6">
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-primary" />
              <p className="text-muted-foreground">
                <span className="font-medium text-foreground">Ne partagez jamais</span> votre mot de
                passe, un code reçu par SMS ou votre code QR de remise, même avec quelqu’un qui dit
                travailler pour SwiftGoma.
              </p>
            </div>
          </Reveal>

          <Reveal delay={380}>
            <p className="text-sm leading-6 text-muted-foreground">
              Votre compte est suspendu et vous ne pouvez pas vous connecter ?{" "}
              <Link href="/auth/support" className={linkClassName}>
                Contactez le Support sans vous connecter
              </Link>
              .
            </p>
          </Reveal>
        </div>

        <Reveal delay={150}>
          <SupportForm />
        </Reveal>
      </section>
    </div>
  );
}
