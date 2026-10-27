import { createDialogStore } from "@/shared/ui/dialog";

/** The code dialog opened after the e-mail or phone sign-in is submitted. */
export const loginCodeDialog = createDialogStore();

/** The two-step code dialog opened after the password sign-in is submitted. */
export const passwordCodeDialog = createDialogStore();

/** The code dialog opened after the create-account form is submitted. */
export const registerCodeDialog = createDialogStore();
