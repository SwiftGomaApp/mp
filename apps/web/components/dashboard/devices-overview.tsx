"use client";

import { useEffect, useState } from "react";
import { LogOut, Monitor, Smartphone, X } from "lucide-react";
import type { DeviceSession } from "swiftgoma-mp-auth";

import { useLogout } from "@/components/auth/logout-screen";
import { formatDateTime, formatPlace, formatRelative } from "@/components/dashboard/format-date";
import { ErrorText } from "@/components/security/recovery-codes-step";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { auth } from "@/lib/auth";
import { authErrorMessage } from "@/lib/auth-errors";

export function DevicesOverview() {
  const { logoutAll } = useLogout();
  const [devices, setDevices] = useState<DeviceSession[] | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [allOpen, setAllOpen] = useState(false);
  const [isSigningOutAll, setIsSigningOutAll] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    auth.devices
      .list()
      .then((result) => {
        if (!cancelled)
          setDevices([...result].sort((a, b) => Number(b.current) - Number(a.current)));
      })
      .catch((err) => {
        if (!cancelled) setError(authErrorMessage(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function disconnect(device: DeviceSession) {
    setBusyId(device.id);
    setError(null);
    try {
      await auth.devices.disconnect(device.id);
      setDevices((current) => current?.filter((item) => item.id !== device.id) ?? null);
      setConfirmingId(null);
    } catch (err) {
      setError(authErrorMessage(err));
    } finally {
      setBusyId(null);
    }
  }

  async function handleLogoutAll() {
    setIsSigningOutAll(true);
    setError(null);
    try {
      await logoutAll();
    } catch (err) {
      setError(authErrorMessage(err));
      setAllOpen(false);
      setIsSigningOutAll(false);
    }
  }

  const others = devices?.filter((device) => !device.current).length ?? 0;

  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-4">
        <div className="grid gap-0.5">
          <h2 className="font-semibold">Appareils connectés</h2>
          <p className="text-sm text-muted-foreground">
            Les appareils où votre compte est ouvert. Déconnectez ceux que vous ne reconnaissez pas.
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={!devices} onClick={() => setAllOpen(true)}>
          <LogOut />
          Se déconnecter partout
        </Button>
      </section>

      {error && <ErrorText>{error}</ErrorText>}

      <ul className="grid gap-3">
        {!devices && !error && (
          <>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-20 w-full rounded-xl" />
          </>
        )}

        {devices?.map((device) => {
          const Icon = device.platform === "WEB" ? Monitor : Smartphone;
          const place = formatPlace(device.city, device.country);
          const isBusy = busyId === device.id;
          const isConfirming = confirmingId === device.id;

          return (
            <li key={device.id} className="flex items-center gap-4 rounded-xl border bg-card p-4">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
              </span>

              <div className="grid min-w-0 flex-1 gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold">
                    {device.deviceName ?? "Appareil inconnu"}
                  </p>
                  {device.current && (
                    <Badge
                      variant="secondary"
                      className="border-0 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400"
                    >
                      Cet appareil
                    </Badge>
                  )}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {[place, device.ipAddress].filter(Boolean).join(" · ") || "Lieu inconnu"}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {device.lastSeenAt
                    ? `Actif ${formatRelative(device.lastSeenAt)}`
                    : "Jamais actif"}{" "}
                  · connecté le {formatDateTime(device.createdAt)}
                </p>
              </div>

              {!device.current &&
                (isConfirming ? (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={isBusy}
                      onClick={() => disconnect(device)}
                    >
                      {isBusy && <Spinner data-icon="inline-start" />}
                      Déconnecter
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      aria-label="Annuler"
                      disabled={isBusy}
                      onClick={() => setConfirmingId(null)}
                    >
                      <X />
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => setConfirmingId(device.id)}>
                    Déconnecter
                  </Button>
                ))}
            </li>
          );
        })}
      </ul>

      <Dialog open={allOpen} onOpenChange={(open) => !isSigningOutAll && setAllOpen(open)}>
        <DialogContent className="gap-5 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Se déconnecter partout ?</DialogTitle>
            <DialogDescription>
              {others > 0
                ? `Cet appareil et ${others} autre${others > 1 ? "s" : ""} seront déconnectés. `
                : "Cet appareil sera déconnecté. "}
              Vous devrez vous reconnecter.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAllOpen(false)} disabled={isSigningOutAll}>
              Annuler
            </Button>
            <Button variant="destructive" onClick={handleLogoutAll} disabled={isSigningOutAll}>
              {isSigningOutAll && <Spinner data-icon="inline-start" />}
              Tout déconnecter
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
