"use client";

import { useState } from "react";
import { Check, Copy, Download, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function ErrorText({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-1.5 text-xs text-destructive">
      <TriangleAlert className="mt-px size-3.5 shrink-0" />
      {children}
    </p>
  );
}

interface RecoveryCodesStepProps {
  codes: string[];
  saved: boolean;
  onSavedChange: (saved: boolean) => void;
  onFinish: () => void;
}

/** The backup codes, shown once. The user must confirm they saved them before moving on. */
export function RecoveryCodesStep({
  codes,
  saved,
  onSavedChange,
  onFinish,
}: RecoveryCodesStepProps) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard access can be denied; the codes stay visible to copy by hand.
    }
  }

  function download() {
    const blob = new Blob([`Codes de récupération SwiftGoma\n\n${codes.join("\n")}\n`], {
      type: "text/plain",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "swiftgoma-codes-de-recuperation.txt";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Enregistrez vos codes de récupération</DialogTitle>
        <DialogDescription>
          Ces codes vous permettent de vous connecter si vous perdez l’accès à votre application
          d’authentification. Conservez-les dans un gestionnaire de mots de passe ou un endroit sûr,
          hors de ce navigateur. Ils ne seront plus affichés.
        </DialogDescription>
      </DialogHeader>

      <div className="overflow-hidden rounded-xl border">
        <ul className="grid grid-cols-2 gap-x-4 gap-y-3 p-4 font-mono text-xs text-muted-foreground">
          {codes.map((code) => (
            <li key={code}>{code}</li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 border-t bg-muted/30 p-2">
          <Button variant="outline" size="sm" onClick={copy}>
            {copied ? <Check /> : <Copy />}
            Copier
          </Button>
          <Button variant="outline" size="sm" onClick={download}>
            <Download />
            Télécharger
          </Button>
        </div>
      </div>

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <Checkbox
          checked={saved}
          onCheckedChange={(checked) => onSavedChange(checked === true)}
          className="mt-0.5"
        />
        <span>J’ai enregistré ces codes dans un endroit accessible si je perds mon appareil.</span>
      </label>

      <DialogFooter>
        <Button className="w-full sm:w-full" onClick={onFinish} disabled={!saved}>
          J’ai enregistré ces codes
        </Button>
      </DialogFooter>
    </>
  );
}
