export type LegalDocId = "terms" | "privacy" | "buyerTerms";

/**
 * Text fields can mark words in bold with **double stars**.
 */
export type LegalSection = {
  heading: string;
  /** A key point, shown first in a highlighted box. */
  note?: string;
  /** Paragraphs. */
  body?: string[];
  /** A bulleted list shown after the paragraphs. */
  bullets?: string[];
};

export type LegalDocument = {
  title: string;
  /** Matches the version the server records when a user accepts (`legal.termsVersion`). */
  version: string;
  intro: string;
  sections: LegalSection[];
};

export type LegalContent = Record<LegalDocId, LegalDocument>;
