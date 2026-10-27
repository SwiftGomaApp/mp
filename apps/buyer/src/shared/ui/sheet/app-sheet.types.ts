import type { ReactElement } from "react";

export type SheetDetent = "medium" | "large" | { fraction: number } | { height: number };

export type AppSheetProps = {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactElement;
  detents?: SheetDetent[];
  showDragIndicator?: boolean;
  dismissible?: boolean;
};
