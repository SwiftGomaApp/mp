"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "swiftgoma-mp-auth/react";

import { Badge, Button, Card, Empty, ErrorBanner, Notice, PageHeader, Spinner, formatDate, useAsync } from "@/components/ui";
import { auth } from "@/lib/auth";

export default function AccountPage() {
  const router = useRouter();
  const user = useSession().user;
  const devices = useAsync(() => auth.devices.list(), []);
  const [error, setError] = useState<unknown>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setError(null);
    setMessage(null);
    try {
      await action();
    } catch (err) {
      setError(err);
    }
  }

  return (
    <>
      <PageHeader title="Mon compte" description="Votre session et vos appareils connectés." />
      <div className="grid gap-4">
        <ErrorBanner error={error} />
        {message && <Notice tone="good">{message}</Notice>}
        <Card title="Profil">
          <p className="text-sm">
            {user?.name} · {user?.email} · <Badge>{user?.role}</Badge>
          </p>
          <div className="mt-4 flex gap-2">
            <Button
              variant="outline"
              onClick={() =>
                run(async () => {
                  await auth.logout();
                  router.replace("/login");
                })
              }
            >
              Se déconnecter
            </Button>
            <Button
              variant="danger"
              onClick={() =>
                run(async () => {
                  const result = await auth.logoutAll();
                  setMessage(`${result.revoked} session(s) révoquée(s).`);
                  router.replace("/login");
                })
              }
            >
              Déconnecter tous mes appareils
            </Button>
          </div>
        </Card>
        <Card title="Appareils connectés">
          <ErrorBanner error={devices.error} />
          {devices.loading && !devices.data && <Spinner />}
          {devices.data && devices.data.length === 0 && <Empty>Aucun appareil.</Empty>}
          <ul className="divide-y divide-border">
            {devices.data?.map((device) => (
              <li key={device.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                <div>
                  <p className="font-medium">
                    {device.deviceName ?? device.platform} {device.current && <Badge tone="good">cet appareil</Badge>}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {[device.city, device.country, device.ipAddress].filter(Boolean).join(" · ") || "—"} · vu le{" "}
                    {formatDate(device.lastSeenAt)}
                  </p>
                </div>
                {!device.current && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      run(async () => {
                        await auth.devices.disconnect(device.id);
                        devices.reload();
                      })
                    }
                  >
                    Déconnecter
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}
