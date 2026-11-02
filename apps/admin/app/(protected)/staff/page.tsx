"use client";

import { useState } from "react";
import Link from "next/link";

import { StepUpField } from "@/components/step-up-field";
import {
  Badge,
  Button,
  Card,
  Empty,
  ErrorBanner,
  Field,
  FormDialog,
  Input,
  Notice,
  PageHeader,
  Pager,
  Select,
  Spinner,
  StatusBadge,
  Textarea,
  formatDate,
  useAsync,
} from "@/components/ui";
import { staff } from "@/lib/auth";
import type { SupportRequestStatus } from "swiftgoma-mp-auth/staff";
import { useIsAdmin } from "@/lib/use-role";

type Dialog = "create" | "resend" | "reset2fa" | { close: string } | null;

function SupportRequests({ onChanged }: { onChanged: (message: string) => void }) {
  const isAdmin = useIsAdmin();
  const [status, setStatus] = useState<SupportRequestStatus | "">("OPEN");
  const [page, setPage] = useState(1);
  const [closing, setClosing] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const { data, error, loading, reload } = useAsync(
    () => staff.supportRequests.list({ status: status || undefined, page, limit: 20 }),
    [status, page],
  );

  return (
    <Card
      title="Demandes de comptes suspendus"
      actions={
        <Select
          aria-label="Statut"
          className="w-36"
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value as SupportRequestStatus | "");
          }}
        >
          <option value="OPEN">Ouvertes</option>
          <option value="CLOSED">Fermées</option>
          <option value="">Toutes</option>
        </Select>
      }
    >
      <ErrorBanner error={error} />
      {loading && !data && <Spinner />}
      {data &&
        (data.items.length === 0 ? (
          <Empty>Aucune demande.</Empty>
        ) : (
          <>
            <ul className="grid gap-3">
              {data.items.map((request) => (
                <li key={request.id} className="rounded-md border border-border p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <Link href={`/users/${request.user.id}`} className="font-medium text-primary hover:underline">
                      {request.user.name || request.user.email || request.user.phone}
                    </Link>
                    <div className="flex items-center gap-2">
                      <StatusBadge value={request.user.status} />
                      <Badge tone={request.status === "OPEN" ? "warn" : "good"}>{request.status}</Badge>
                    </div>
                  </div>
                  <p className="mt-2">{request.message}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDate(request.createdAt)}
                    {request.closedAt && ` · fermée le ${formatDate(request.closedAt)}`}
                    {request.note && ` · note : ${request.note}`}
                  </p>
                  {request.status === "OPEN" && isAdmin && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2"
                      onClick={() => {
                        setNote("");
                        setClosing(request.id);
                      }}
                    >
                      Fermer la demande
                    </Button>
                  )}
                </li>
              ))}
            </ul>
            <Pager page={data.page} limit={data.limit} total={data.total} onPage={setPage} />
          </>
        ))}

      <FormDialog
        open={closing !== null}
        title="Fermer la demande"
        submitLabel="Fermer"
        onClose={() => setClosing(null)}
        onSubmit={async () => {
          await staff.supportRequests.close(closing!, { note: note.trim() || undefined });
          onChanged("Demande fermée.");
          reload();
        }}
      >
        <Field label="Note (facultatif)">
          <Textarea maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </FormDialog>
    </Card>
  );
}

export default function StaffPage() {
  const isAdmin = useIsAdmin();
  const [dialog, setDialog] = useState<Dialog>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [staffId, setStaffId] = useState("");
  const [reason, setReason] = useState("");
  const [code, setCode] = useState("");

  function open(next: Dialog) {
    setCode("");
    setReason("");
    setDialog(next);
  }

  return (
    <>
      <PageHeader title="Personnel et demandes" description="Comptes du personnel et demandes des comptes suspendus." />
      {message && (
        <div className="mb-4">
          <Notice tone="good">{message}</Notice>
        </div>
      )}
      <div className="grid gap-4">
        <Card title="Comptes du personnel">
          {isAdmin ? (
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => open("create")}>Créer un compte Support</Button>
              <Button variant="outline" onClick={() => open("resend")}>
                Renvoyer le lien d&apos;activation
              </Button>
              <Button variant="danger" onClick={() => open("reset2fa")}>
                Réinitialiser la 2FA d&apos;un membre
              </Button>
            </div>
          ) : (
            <Notice>La gestion des comptes du personnel est réservée aux Administrateurs.</Notice>
          )}
        </Card>
        <SupportRequests onChanged={setMessage} />
      </div>

      <FormDialog
        open={dialog === "create"}
        title="Créer un compte Support"
        description="Le membre reçoit un lien d'activation par e-mail."
        submitLabel="Créer"
        canSubmit={code.length === 6}
        onClose={() => setDialog(null)}
        onSubmit={async () => {
          const created = await staff.create({ name: name.trim(), email: email.trim(), code });
          setMessage(`Compte créé pour ${created.email}. Un lien d'activation a été envoyé.`);
        }}
      >
        <Field label="Nom">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="E-mail">
          <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <StepUpField value={code} onChange={setCode} />
      </FormDialog>

      <FormDialog
        open={dialog === "resend"}
        title="Renvoyer le lien d'activation"
        submitLabel="Renvoyer"
        canSubmit={code.length === 6 && staffId.trim().length > 0}
        onClose={() => setDialog(null)}
        onSubmit={async () => {
          const result = await staff.resendSetup(staffId.trim(), { code });
          setMessage(result.message);
        }}
      >
        <Field label="Identifiant du membre (UUID)">
          <Input required value={staffId} onChange={(e) => setStaffId(e.target.value)} />
        </Field>
        <StepUpField value={code} onChange={setCode} />
      </FormDialog>

      <FormDialog
        open={dialog === "reset2fa"}
        title="Réinitialiser la 2FA d'un membre"
        description="Par exemple après la perte d'un téléphone."
        submitLabel="Réinitialiser"
        danger
        canSubmit={code.length === 6 && staffId.trim().length > 0 && reason.trim().length >= 5}
        onClose={() => setDialog(null)}
        onSubmit={async () => {
          await staff.resetTwoFactor(staffId.trim(), { code, reason: reason.trim() });
          setMessage("Double vérification désactivée pour ce membre.");
        }}
      >
        <Field label="Identifiant du membre (UUID)">
          <Input required value={staffId} onChange={(e) => setStaffId(e.target.value)} />
        </Field>
        <Field label="Raison">
          <Textarea required maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} />
        </Field>
        <StepUpField value={code} onChange={setCode} />
      </FormDialog>
    </>
  );
}
