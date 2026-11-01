"use client";

import { useEffect, useState } from "react";
import { Check, Loader2 } from "lucide-react";

type RequestState = "idle" | "pending" | "accepted";

const PANEL = "animate-in duration-500 fade-in slide-in-from-bottom-2 motion-reduce:animate-none";

export function LinkRequestDemo() {
  const [state, setState] = useState<RequestState>("idle");

  useEffect(() => {
    if (state !== "pending") return;
    const timer = setTimeout(() => setState("accepted"), 1800);
    return () => clearTimeout(timer);
  }, [state]);

  return (
    <div className="w-full max-w-sm rounded-2xl border bg-card p-5 text-card-foreground">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="flex size-10 items-center justify-center rounded-full bg-muted text-sm font-semibold"
        >
          BA
        </span>
        <span className="grid leading-tight">
          <span className="text-sm font-semibold">Boutique Amani</span>
          <span className="text-xs text-muted-foreground">Himbi · Mode et accessoires</span>
        </span>
      </div>

      <div className="mt-5 min-h-24 border-t pt-5">
        {state === "idle" && (
          <div key="idle" className={PANEL}>
            <button
              type="button"
              onClick={() => setState("pending")}
              className="w-full cursor-pointer rounded-md bg-primary py-2 text-sm font-medium text-primary-foreground transition-opacity outline-none hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              Demander la liaison
            </button>
            <p className="mt-3 text-center text-xs text-muted-foreground">
              Le vendeur accepte ou refuse votre demande.
            </p>
          </div>
        )}

        {state === "pending" && (
          <div key="pending" className={`${PANEL} grid justify-items-center gap-3 py-2`}>
            <Loader2 className="size-5 animate-spin text-muted-foreground motion-reduce:animate-none" />
            <p className="text-sm font-medium">Demande envoyée</p>
            <p className="text-xs text-muted-foreground">En attente de la réponse du vendeur…</p>
          </div>
        )}

        {state === "accepted" && (
          <div
            key="accepted"
            className={`${PANEL} grid justify-items-center gap-3 py-2 text-center`}
          >
            <span className="flex size-10 animate-in items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 duration-500 zoom-in-50 dark:text-emerald-400">
              <Check className="size-5" />
            </span>
            <p className="text-sm font-medium">Liaison active</p>
            <p className="text-xs text-muted-foreground">Vous pouvez recevoir ses livraisons.</p>
            <button
              type="button"
              onClick={() => setState("idle")}
              className="cursor-pointer text-xs text-muted-foreground underline underline-offset-4 outline-none hover:text-foreground focus-visible:text-foreground"
            >
              Rejouer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
