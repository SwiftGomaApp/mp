"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "swiftgoma-mp-auth/react";

import { AddressesManager } from "@/components/dashboard/addresses-manager";

/** Addresses are a buyer feature: other roles go back to the profile. */
export function AddressesPage() {
  const router = useRouter();
  const { user } = useSession();
  const isBuyer = user?.role === "BUYER";

  useEffect(() => {
    if (user && !isBuyer) router.replace("/profile");
  }, [user, isBuyer, router]);

  return isBuyer ? <AddressesManager /> : null;
}
