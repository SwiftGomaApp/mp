import { buyerTerms } from "@/lib/legal/documents/buyer-terms";
import { cookies } from "@/lib/legal/documents/cookies";
import { privacy } from "@/lib/legal/documents/privacy";
import { riderTerms } from "@/lib/legal/documents/rider-terms";
import { sellerTerms } from "@/lib/legal/documents/seller-terms";
import { terms } from "@/lib/legal/documents/terms";
import { LEGAL_BASE_PATH } from "@/lib/legal/config";
import type { LegalDocument } from "@/lib/legal/types";

export const legalDocuments: readonly LegalDocument[] = [
  terms,
  privacy,
  cookies,
  buyerTerms,
  sellerTerms,
  riderTerms,
];

export const legalPath = (slug: string) => `${LEGAL_BASE_PATH}/${slug}`;

export function getLegalDocument(slug: string): LegalDocument {
  const document = legalDocuments.find((item) => item.slug === slug);
  if (!document) throw new Error(`Unknown legal document: ${slug}`);
  return document;
}
