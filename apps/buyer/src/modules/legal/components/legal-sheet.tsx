import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Text, View } from "react-native";

import { useThemeColors } from "@/core/theme";
import { ScrollSheet, SheetHeader } from "@/shared/ui/sheet";

import { legalFr } from "../content/fr";
import type { LegalDocId } from "../types";
import { RichText } from "./rich-text";

const PARAGRAPH = "font-sans text-[15px] leading-[24px] text-foreground";

type LegalSheetProps = {
  /** The document to show, or null when the sheet is closed. */
  docId: LegalDocId | null;
  onClose: () => void;
};

export function LegalSheet({ docId, onClose }: LegalSheetProps) {
  const colors = useThemeColors();

  // Keeps showing the last document while the sheet slides away.
  const [shown, setShown] = useState<LegalDocId>("terms");
  if (docId && docId !== shown) setShown(docId);

  const document = legalFr[shown];

  return (
    <ScrollSheet
      isOpen={docId !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      showDragIndicator
      // A long text: it opens at half height, and the user drags it up to read it full screen.
      detents={["medium", "large"]}
      header={
        <SheetHeader
          icon={
            <SymbolView
              name={
                shown === "privacy"
                  ? { ios: "lock.shield", android: "shield", web: "shield" }
                  : { ios: "doc.text", android: "description", web: "description" }
              }
              size={22}
              tintColor={colors.foreground}
            />
          }
          title={document.title}
          description={`Version ${document.version}`}
          onClose={onClose}
        />
      }
    >
      <View className="pt-5">
        <RichText className="font-sans text-[15px] leading-[24px] text-muted-foreground">
          {document.intro}
        </RichText>

        <View className="mt-5 h-px bg-border" />

        <View className="gap-8 pt-6">
          {document.sections.map((section, index) => (
            <View key={section.heading} className="gap-3">
              {/* Same size and line height for both, so they sit on the same line; the number has a
                  fixed width, so a title starts at the same place whether it is "1." or "10." */}
              <View className="flex-row items-start">
                <Text className="w-8 font-sans-bold text-[18px] leading-[26px] text-primary">
                  {index + 1}.
                </Text>
                <Text className="flex-1 font-sans-bold text-[18px] leading-[26px] text-foreground">
                  {section.heading}
                </Text>
              </View>

              {section.note ? (
                <View className="rounded-xl border-l-4 border-primary bg-muted px-4 py-3">
                  <RichText className={`${PARAGRAPH} font-sans-medium`}>{section.note}</RichText>
                </View>
              ) : null}

              {section.body?.map((paragraph) => (
                <RichText key={paragraph} className={PARAGRAPH}>
                  {paragraph}
                </RichText>
              ))}

              {section.bullets ? (
                <View className="gap-3">
                  {section.bullets.map((bullet) => (
                    <View key={bullet} className="flex-row gap-3 pr-1">
                      <View className="mt-[10px] h-1.5 w-1.5 rounded-full bg-primary" />
                      <RichText className={`flex-1 ${PARAGRAPH}`}>{bullet}</RichText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </ScrollSheet>
  );
}
