"use client";

import { useState } from "react";

import { ActivityTable } from "@/components/activity-table";
import {
  Button,
  Card,
  ErrorBanner,
  Field,
  Input,
  Notice,
  PageHeader,
  Pager,
  Select,
  Spinner,
  useAsync,
} from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { useIsAdmin } from "@/lib/use-role";

const EMPTY = { userId: "", actorId: "", event: "", success: "", from: "", to: "" };

export default function AuditPage() {
  const isAdmin = useIsAdmin();
  const [draft, setDraft] = useState(EMPTY);
  const [filters, setFilters] = useState(EMPTY);
  const [page, setPage] = useState(1);

  const iso = (value: string) => (value ? new Date(value).toISOString() : "");
  const { data, error, loading } = useAsync(
    () =>
      isAdmin
        ? adminApi.listAudit({
            page,
            limit: 30,
            ...filters,
            from: iso(filters.from),
            to: iso(filters.to),
          })
        : Promise.resolve(null),
    [page, filters, isAdmin],
  );

  const set = (key: keyof typeof EMPTY) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft({ ...draft, [key]: e.target.value });

  return (
    <>
      <PageHeader title="Journal d'audit" description="Toute l'activité des comptes, filtrable (Administrateurs)." />
      {!isAdmin ? (
        <Notice>Le journal d&apos;audit est réservé aux Administrateurs.</Notice>
      ) : (
        <Card>
          <form
            className="mb-4 grid gap-3 sm:grid-cols-3"
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setFilters(draft);
            }}
          >
            <Field label="Utilisateur (UUID)">
              <Input value={draft.userId} onChange={set("userId")} />
            </Field>
            <Field label="Auteur de l'action (UUID)">
              <Input value={draft.actorId} onChange={set("actorId")} />
            </Field>
            <Field label="Événement">
              <Input placeholder="ex. ROLE_CHANGED" value={draft.event} onChange={set("event")} />
            </Field>
            <Field label="Résultat">
              <Select value={draft.success} onChange={set("success")}>
                <option value="">Tous</option>
                <option value="true">Réussi</option>
                <option value="false">Échec</option>
              </Select>
            </Field>
            <Field label="Du">
              <Input type="datetime-local" value={draft.from} onChange={set("from")} />
            </Field>
            <Field label="Au">
              <Input type="datetime-local" value={draft.to} onChange={set("to")} />
            </Field>
            <div className="flex gap-2 sm:col-span-3">
              <Button type="submit">Filtrer</Button>
              <Button
                variant="outline"
                onClick={() => {
                  setDraft(EMPTY);
                  setFilters(EMPTY);
                  setPage(1);
                }}
              >
                Réinitialiser
              </Button>
            </div>
          </form>
          <ErrorBanner error={error} />
          {loading && !data && <Spinner />}
          {data && (
            <>
              <ActivityTable items={data.items} showUser />
              <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
            </>
          )}
        </Card>
      )}
    </>
  );
}
