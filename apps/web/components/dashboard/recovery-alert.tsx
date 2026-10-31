"use client";

import { useEffect, useState } from "react";
import { ShieldAlert } from "lucide-react";

import { formatDateTime } from "@/components/dashboard/format-date";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { account } from "@/lib/account";
import { authErrorMessage } from "@/lib/auth-errors";

/**
 * Someone asked to recover this account. The owner has until the end of the security delay to say
 * it was not them; the banner shows on every dashboard page until then.
 */
export function RecoveryAlert() {
  const [availableAt, setAvailableAt] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    account
      .security()
      .then(({ pendingRecovery }) => {
        if (!cancelled) setAvailableAt(pendingRecovery?.availableAt ?? null);
      })
      .catch(() => {
        // The banner is a safety net: without the answer nothing is shown.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!availableAt) return null;

  async function cancel() {
    setIsCancelling(true);
    setError(null);
    try {
      await account.recovery.cancel();
      setAvailableAt(null);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setIsCancelling(false);
    }
  }

  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-3 border-b border-destructive/20 bg-destructive/5 px-4 py-3 text-sm"
    >
      <ShieldAlert className="size-5 shrink-0 text-destructive" />
      <p className="min-w-0 flex-1 text-foreground/90">
        <span className="font-semibold">Récupération du compte demandée.</span> Quelqu’un a demandé
        à récupérer ce compte ; elle pourra se terminer à partir du {formatDateTime(availableAt)}.
        Si ce n’est pas vous, annulez-la maintenant.
        {error && <span className="ml-1 text-destructive">{error}</span>}
      </p>
      <Button variant="destructive" size="sm" onClick={cancel} disabled={isCancelling}>
        {isCancelling && <Spinner data-icon="inline-start" />}
        Ce n’est pas moi
      </Button>
    </div>
  );
}
