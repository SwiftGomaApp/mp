/**
 * A block of a legal section. A plain string is a paragraph; inline `**bold**` and
 * `[label](/path)` links are supported inside every text.
 */
export type LegalBlock =
  | string
  | { heading: string }
  | { list: string[] }
  | { steps: string[] }
  | { note: string }
  | { table: { head: string[]; rows: string[][] } };

export interface LegalSection {
  id: string;
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocument {
  slug: string;
  /** Page title. */
  title: string;
  /** Label used in the navigation and the footer. */
  shortTitle: string;
  description: string;
  /** ISO date (YYYY-MM-DD). */
  lastUpdated: string;
  /** Version stored with the user's acceptance. */
  version: string;
  intro: string;
  sections: LegalSection[];
}
