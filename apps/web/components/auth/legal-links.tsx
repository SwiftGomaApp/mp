import Link from "next/link";

import type { SignUpRole } from "@/lib/auth-flow";

export const ROLE_TERMS: Record<SignUpRole, { href: string; label: string }> = {
  BUYER: { href: "/legale/buyer-terms", label: "conditions acheteur" },
  SELLER: { href: "/legale/seller-terms", label: "conditions vendeur" },
  RIDER: { href: "/legale/rider-terms", label: "conditions livreur" },
};

export function LegalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
    >
      {children}
    </Link>
  );
}

/** "By continuing…" line with the legal links; adds the role's terms when the role is known. */
export function LegalNotice({ role }: { role?: SignUpRole }) {
  return (
    <p className="text-center text-xs leading-5 text-muted-foreground">
      En continuant, vous acceptez nos{" "}
      <LegalLink href="/legale/terms">conditions d’utilisation</LegalLink>
      {role && (
        <>
          , nos <LegalLink href={ROLE_TERMS[role].href}>{ROLE_TERMS[role].label}</LegalLink>
        </>
      )}{" "}
      et notre <LegalLink href="/legale/privacy">politique de confidentialité</LegalLink>.
    </p>
  );
}

/** The two legal links over the sign-in image, in white. */
export function LegalImageLinks() {
  const className =
    "text-[0.65rem] font-medium text-white/70 underline-offset-4 transition-colors outline-none hover:text-white hover:underline focus-visible:text-white focus-visible:underline";

  return (
    <nav aria-label="Informations légales" className="flex gap-4">
      <Link href="/legale/terms" target="_blank" rel="noopener noreferrer" className={className}>
        Conditions d’utilisation
      </Link>
      <Link href="/legale/privacy" target="_blank" rel="noopener noreferrer" className={className}>
        Confidentialité
      </Link>
    </nav>
  );
}
