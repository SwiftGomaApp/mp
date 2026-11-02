"use client";

import Link from "next/link";

import { Badge, Empty, Table, Td, Th, formatDate } from "@/components/ui";
import type { ActivityRow } from "@/lib/types";

export function ActivityTable({
  items,
  showUser,
}: {
  items: ActivityRow[];
  showUser?: boolean;
}) {
  if (!items.length) return <Empty>Aucune activité.</Empty>;
  return (
    <Table>
      <thead>
        <tr>
          <Th>Date</Th>
          <Th>Événement</Th>
          {showUser && <Th>Utilisateur</Th>}
          <Th>IP</Th>
          <Th>Détails</Th>
        </tr>
      </thead>
      <tbody>
        {items.map((row) => (
          <tr key={row.id}>
            <Td className="whitespace-nowrap">{formatDate(row.createdAt)}</Td>
            <Td>
              <span className="font-mono text-xs">{row.event}</span>{" "}
              {!row.success && <Badge tone="bad">échec</Badge>}
            </Td>
            {showUser && (
              <Td>
                {row.userId ? (
                  <Link href={`/users/${row.userId}`} className="font-mono text-xs text-primary hover:underline">
                    {row.userId.slice(0, 8)}…
                  </Link>
                ) : (
                  "—"
                )}
              </Td>
            )}
            <Td className="font-mono text-xs">{row.ipAddress ?? "—"}</Td>
            <Td className="max-w-xs font-mono text-xs break-all text-muted-foreground">
              {row.metadata ? JSON.stringify(row.metadata) : "—"}
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
