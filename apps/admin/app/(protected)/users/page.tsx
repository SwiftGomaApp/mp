"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";

import {
  Button,
  Card,
  Empty,
  ErrorBanner,
  Input,
  PageHeader,
  Pager,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Td,
  Th,
  formatDate,
  useAsync,
} from "@/components/ui";
import { adminApi } from "@/lib/admin-api";
import { ALL_ROLES, USER_STATUSES } from "@/lib/types";

export default function UsersPage() {
  const [page, setPage] = useState(1);
  const [draft, setDraft] = useState("");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");

  const { data, error, loading } = useAsync(
    () => adminApi.listUsers({ page, limit: 20, q, role, status, sort, order }),
    [page, q, role, status, sort, order],
  );

  function search(event: React.FormEvent) {
    event.preventDefault();
    setPage(1);
    setQ(draft.trim());
  }
  const filter = (apply: (v: string) => void) => (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPage(1);
    apply(e.target.value);
  };

  return (
    <>
      <PageHeader title="Utilisateurs" description="Recherchez et gérez les comptes SwiftGoma." />
      <Card>
        <form onSubmit={search} className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto_auto_auto]">
          <Input
            placeholder="Nom, e-mail, téléphone ou identifiant (2 caractères min.)"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Select aria-label="Rôle" value={role} onChange={filter(setRole)}>
            <option value="">Tous les rôles</option>
            {ALL_ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </Select>
          <Select aria-label="Statut" value={status} onChange={filter(setStatus)}>
            <option value="">Tous les statuts</option>
            {USER_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select aria-label="Tri" value={sort} onChange={filter(setSort)}>
            <option value="createdAt">Création</option>
            <option value="lastLoginAt">Dernière connexion</option>
          </Select>
          <Select aria-label="Ordre" value={order} onChange={filter(setOrder)}>
            <option value="desc">Décroissant</option>
            <option value="asc">Croissant</option>
          </Select>
          <Button type="submit">
            <Search className="size-4" />
            Chercher
          </Button>
        </form>

        <ErrorBanner error={error} />
        {loading && !data && (
          <div className="flex justify-center py-10">
            <Spinner />
          </div>
        )}
        {data &&
          (data.items.length === 0 ? (
            <Empty>Aucun utilisateur.</Empty>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Utilisateur</Th>
                    <Th>Rôle</Th>
                    <Th>Statut</Th>
                    <Th>Vérification</Th>
                    <Th>Dernière connexion</Th>
                    <Th>Créé le</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/50">
                      <Td>
                        <Link href={`/users/${u.id}`} className="font-medium text-primary hover:underline">
                          {u.name || u.email || u.phone || u.id}
                        </Link>
                        <p className="text-xs text-muted-foreground">{u.email ?? u.phone ?? "—"}</p>
                      </Td>
                      <Td>{u.role}</Td>
                      <Td>
                        <StatusBadge value={u.status} />
                      </Td>
                      <Td>
                        <StatusBadge value={u.verificationStatus} />
                      </Td>
                      <Td className="whitespace-nowrap">{formatDate(u.lastLoginAt)}</Td>
                      <Td className="whitespace-nowrap">{formatDate(u.createdAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
            </>
          ))}
      </Card>
    </>
  );
}
