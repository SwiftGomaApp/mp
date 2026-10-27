import { useState } from "react";
import { Keyboard, Text } from "react-native";

import { legalFr } from "../content/fr";
import type { LegalDocId } from "../types";
import { LegalSheet } from "./legal-sheet";

/**
 * "En continuant, vous acceptez les Conditions d'utilisation, la Politique de confidentialité et les
 * Conditions Acheteur." Each document name opens its text in a sheet.
 */
export function LegalLinks() {
  const [docId, setDocId] = useState<LegalDocId | null>(null);

  const open = (id: LegalDocId) => {
    Keyboard.dismiss();
    setDocId(id);
  };

  const link = (id: LegalDocId) => (
    <Text
      suppressHighlighting
      accessibilityRole="link"
      className="font-sans-medium text-primary"
      onPress={() => open(id)}
    >
      {legalFr[id].title}
    </Text>
  );

  return (
    <>
      <Text className="text-center font-sans text-[12px] leading-[18px] text-muted-foreground">
        {"En continuant, vous acceptez les "}
        {link("terms")}
        {", la "}
        {link("privacy")}
        {" et les "}
        {link("buyerTerms")}
        {"."}
      </Text>

      <LegalSheet docId={docId} onClose={() => setDocId(null)} />
    </>
  );
}
