"use client";

import { useState } from "react";
import Link from "next/link";

import {
  Card,
  Checkbox,
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
import { verificationApi } from "@/lib/admin-api";

const STATUSES = ["PENDING", "IN_REVIEW", "APPROVED", "REJECTED", "EXPIRED"];

export default function VerificationQueuePage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [q, setQ] = useState("");
  const [mine, setMine] = useState(false);

  const { data, error, loading } = useAsync(
    () => verificationApi.listCases({ page, limit: 20, status, type, q: q.trim(), mine: mine ? true : undefined }),
    [page, status, type, q, mine],
  );
  const reset = <T,>(set: (v: T) => void) => (v: T) => {
    setPage(1);
    set(v);
  };

  return (
    <>
      <PageHeader
        title="Vérification vendeurs et livreurs"
        description="File des dossiers, du plus ancien au plus récent. Sans filtre de statut : dossiers en attente et en cours."
      />
      <Card>
        <div className="mb-4 grid items-center gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
          <Input placeholder="Nom, e-mail ou téléphone" value={q} onChange={(e) => reset(setQ)(e.target.value)} />
          <Select aria-label="Statut" value={status} onChange={(e) => reset(setStatus)(e.target.value)}>
            <option value="">En attente + en cours</option>
            {STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select aria-label="Type" value={type} onChange={(e) => reset(setType)(e.target.value)}>
            <option value="">Vendeurs + livreurs</option>
            <option value="SELLER">Vendeurs</option>
            <option value="RIDER">Livreurs</option>
          </Select>
          <Checkbox checked={mine} onChange={reset(setMine)} label="Mes dossiers" />
        </div>
        <ErrorBanner error={error} />
        {loading && !data && <Spinner />}
        {data &&
          (data.items.length === 0 ? (
            <Empty>Aucun dossier.</Empty>
          ) : (
            <>
              <Table>
                <thead>
                  <tr>
                    <Th>Demandeur</Th>
                    <Th>Type</Th>
                    <Th>Statut</Th>
                    <Th>Avis</Th>
                    <Th>Responsable</Th>
                    <Th>Déposé le</Th>
                    <Th>Docs / appels</Th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/50">
                      <Td>
                        <Link href={`/verification/${c.id}`} className="font-medium text-primary hover:underline">
                          {c.user.name || c.user.email || c.user.phone || c.id}
                        </Link>
                        <p className="text-xs text-muted-foreground">{c.user.phone ?? c.user.email ?? "—"}</p>
                      </Td>
                      <Td>
                        {c.type} {c.attempt > 1 && <span className="text-xs text-muted-foreground">(essai {c.attempt})</span>}
                      </Td>
                      <Td>
                        <StatusBadge value={c.status} />
                      </Td>
                      <Td>
                        <StatusBadge value={c.opinion} />
                      </Td>
                      <Td>{c.reviewer?.name ?? "—"}</Td>
                      <Td className="whitespace-nowrap">{formatDate(c.submittedAt)}</Td>
                      <Td>
                        {c._count.documents} / {c._count.calls}
                      </Td>
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
