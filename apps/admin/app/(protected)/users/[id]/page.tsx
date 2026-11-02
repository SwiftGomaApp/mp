"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { ActivityTable } from "@/components/activity-table";
import { UserActions } from "@/components/user-actions";
import {
  Card,
  ErrorBanner,
  PageHeader,
  Pager,
  Spinner,
  StatusBadge,
  formatDate,
  useAsync,
} from "@/components/ui";
import { adminApi } from "@/lib/admin-api";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right break-all">{children}</dd>
    </div>
  );
}

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [page, setPage] = useState(1);
  const user = useAsync(() => adminApi.getUser(id), [id]);
  const activity = useAsync(() => adminApi.listActivity(id, { page, limit: 20 }), [id, page]);

  const refresh = () => {
    user.reload();
    activity.reload();
  };

  return (
    <>
      <Link href="/users" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" /> Utilisateurs
      </Link>
      <ErrorBanner error={user.error} />
      {user.loading && !user.data && <Spinner />}
      {user.data && (
        <>
          <PageHeader
            title={user.data.name || user.data.email || user.data.phone || user.data.id}
            description={user.data.id}
            actions={
              <div className="flex gap-2">
                <StatusBadge value={user.data.role} />
                <StatusBadge value={user.data.status} />
              </div>
            }
          />
          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Compte">
              <dl className="divide-y divide-border">
                <Row label="E-mail">
                  {user.data.email ?? "—"} {user.data.emailVerifiedAt ? "✓" : ""}
                </Row>
                <Row label="Téléphone">
                  {user.data.phone ?? "—"} {user.data.phoneVerifiedAt ? "✓" : ""}
                </Row>
                <Row label="E-mail secondaire">{user.data.secondaryEmail ?? "—"}</Row>
                <Row label="Téléphone secondaire">{user.data.secondaryPhone ?? "—"}</Row>
                <Row label="Vérification vendeur/livreur">
                  <StatusBadge value={user.data.verificationStatus} />
                </Row>
                <Row label="Sessions / clés d'accès">
                  {user.data._count.sessions} / {user.data._count.passkeys}
                </Row>
                <Row label="Créé le">{formatDate(user.data.createdAt)}</Row>
                <Row label="Dernière connexion">{formatDate(user.data.lastLoginAt)}</Row>
                <Row label="Conditions acceptées">
                  {user.data.termsVersion ?? "—"} · {formatDate(user.data.termsAcceptedAt)}
                </Row>
                <Row label="Suppression demandée">{formatDate(user.data.deletionRequestedAt)}</Row>
                <Row label="Suppression prévue">{formatDate(user.data.deletionScheduledAt)}</Row>
                <Row label="Supprimé le">{formatDate(user.data.deletedAt)}</Row>
              </dl>
            </Card>

            <div className="grid content-start gap-4">
              <UserActions user={user.data} onDone={refresh} />
              <Card title="Adresses">
                {user.data.addresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune adresse.</p>
                ) : (
                  <ul className="grid gap-2 text-xs">
                    {user.data.addresses.map((address, index) => (
                      <li key={String(address.id ?? index)} className="rounded bg-muted p-2 font-mono break-all">
                        {JSON.stringify(address)}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
              <Card title="Demandes au Support récentes">
                {user.data.supportRequests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Aucune demande.</p>
                ) : (
                  <ul className="grid gap-2 text-sm">
                    {user.data.supportRequests.map((request) => (
                      <li key={request.id} className="rounded bg-muted p-2">
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <StatusBadge value={request.status} />
                          {formatDate(request.createdAt)}
                        </div>
                        <p className="mt-1">{request.message}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            </div>
          </div>

          <Card title="Activité" className="mt-4">
            <ErrorBanner error={activity.error} />
            {activity.data && (
              <>
                <ActivityTable items={activity.data.items} />
                <Pager page={activity.data.page} limit={activity.data.limit} total={activity.data.total} onPage={setPage} />
              </>
            )}
          </Card>
        </>
      )}
    </>
  );
}
