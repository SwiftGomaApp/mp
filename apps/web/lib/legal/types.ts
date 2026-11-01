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
  title: string;
  shortTitle: string;
  description: string;
  lastUpdated: string;
  version: string;
  intro: string;
  sections: LegalSection[];
}
