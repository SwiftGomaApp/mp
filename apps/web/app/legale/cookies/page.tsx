import { LegalDocumentView } from "@/components/legal/legal-document-view";
import { getLegalDocument, legalPath } from "@/lib/legal";
import { pageMetadata } from "@/lib/seo";

const document = getLegalDocument("cookies");

export const metadata = pageMetadata({
  title: document.title,
  description: document.description,
  path: legalPath(document.slug),
});

export default function Page() {
  return <LegalDocumentView document={document} />;
}
