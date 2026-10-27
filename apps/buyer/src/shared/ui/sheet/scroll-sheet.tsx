import { type ReactNode, useState } from "react";
import { ScrollView, useWindowDimensions, View } from "react-native";

import { AppSheet } from "./app-sheet";
import type { SheetDetent } from "./app-sheet.types";

const MAX_SCREEN_FRACTION = 0.92;

type ScrollSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fixed at the top of the sheet, for example a SheetHeader. */
  header: ReactNode;
  /** Scrolls when the sheet is not tall enough to show everything. */
  children: ReactNode;
  showDragIndicator?: boolean;
  keyboardShouldPersistTaps?: "always" | "never" | "handled";
};

/**
 * A sheet as tall as its content (up to 92% of the screen), instead of a fixed half or full
 * screen. Until the content has been measured, it opens at half height.
 */
export function ScrollSheet({
  isOpen,
  onOpenChange,
  header,
  children,
  showDragIndicator,
  keyboardShouldPersistTaps,
}: ScrollSheetProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [contentHeight, setContentHeight] = useState(0);

  const maxHeight = windowHeight * MAX_SCREEN_FRACTION;
  const detents: SheetDetent[] =
    headerHeight > 0 && contentHeight > 0
      ? [{ height: Math.min(headerHeight + contentHeight, maxHeight) }]
      : ["medium"];

  return (
    <AppSheet
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      detents={detents}
      showDragIndicator={showDragIndicator}
    >
      <View className="flex-1">
        <View
          className="px-6 pt-6"
          onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)}
        >
          {header}
        </View>
        <ScrollView
          className="flex-1"
          bounces={false}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          contentContainerClassName="px-6 pb-6"
          onContentSizeChange={(_, height) => setContentHeight(height)}
        >
          {children}
        </ScrollView>
      </View>
    </AppSheet>
  );
}
