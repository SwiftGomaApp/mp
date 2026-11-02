"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "swiftgoma-mp-auth/react";

import { Spinner } from "@/components/ui/spinner";
import { homePathFor } from "@/lib/roles";

/** Post-login entry point: sends each role to its own home. */
export function RoleHomeRedirect() {
  const router = useRouter();
  const { user } = useSession();

  useEffect(() => {
    if (user) router.replace(homePathFor(user.role));
  }, [user, router]);

  return (
    <div className="flex min-h-64 items-center justify-center text-muted-foreground">
      <Spinner className="size-5" />
    </div>
  );
}
