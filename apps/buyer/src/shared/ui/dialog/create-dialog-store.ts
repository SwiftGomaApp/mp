import { createSheetStore } from "@/shared/ui/sheet";

export function createDialogStore() {
  const store = createSheetStore();
  return { open: store.open, close: store.close, useDialog: store.useSheet };
}
