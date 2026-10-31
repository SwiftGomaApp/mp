import Link from "next/link";

import { SUSPENDED_MESSAGE } from "@/lib/auth-errors";

/** Under a sign-in error: when the account is suspended, the way to reach the Support. */
export function SupportHint({ error }: { error: string | null }) {
  if (error !== SUSPENDED_MESSAGE) return null;

  return (
    <Link
      href="/auth/support"
      className="text-center text-xs font-medium text-foreground underline underline-offset-4 outline-none hover:text-primary focus-visible:text-primary"
    >
      Contacter le Support
    </Link>
  );
}
