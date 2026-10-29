import { AlertDialog, InputDialog } from "@/shared/ui/dialog";

import { codeDialog, confirmDialog } from "../demo-dialogs";

export function DemoDialogs() {
  const [confirmOpen, setConfirmOpen] = confirmDialog.useDialog();
  const [codeOpen, setCodeOpen] = codeDialog.useDialog();

  return (
    <>
      <AlertDialog
        isOpen={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="Se déconnecter ?"
        description="Vous devrez vous reconnecter pour accéder à votre compte."
        submitLabel="Se déconnecter"
        destructive
        onSubmit={() => console.log("déconnecté")}
      />

      <InputDialog
        isOpen={codeOpen}
        onOpenChange={setCodeOpen}
        title="Code de vérification"
        description="Entrez le code à 6 chiffres reçu par e-mail."
        placeholder="000000"
        keyboard="number"
        maxLength={6}
        minLength={6}
        oneTimeCode
        submitLabel="Vérifier"
        onSubmit={(code) => console.log("code saisi :", code)}
      />
    </>
  );
}
