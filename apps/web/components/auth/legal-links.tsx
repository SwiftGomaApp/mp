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
