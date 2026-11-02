"use client";

import { use, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { useSession } from "swiftgoma-mp-auth/react";

import {
  Button,
  Card,
  ErrorBanner,
  Field,
  FormDialog,
  Input,
  Notice,
  PageHeader,
  Select,
  Spinner,
  StatusBadge,
  Table,
  Td,
  Textarea,
  Th,
  formatDate,
  useAsync,
} from "@/components/ui";
import { verificationApi } from "@/lib/admin-api";
import type { CallOutcome, CaseDetail, DocumentType, Opinion } from "@/lib/types";
import { useIsAdmin } from "@/lib/use-role";

const OUTCOMES: CallOutcome[] = ["REACHED", "NO_ANSWER", "WRONG_NUMBER", "REFUSED"];
const OPINIONS: Opinion[] = ["RECOMMEND_APPROVE", "RECOMMEND_REJECT"];

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 text-sm">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right break-all">{children}</dd>
    </div>
  );
}

type Dialog = "call" | "opinion" | "approve" | "reject" | null;

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const isAdmin = useIsAdmin();
  const me = useSession().user;
  const found = useAsync(() => verificationApi.getCase(id), [id]);
  const c: CaseDetail | null = found.data;

  const [dialog, setDialog] = useState<Dialog>(null);
  const [actionError, setActionError] = useState<unknown>(null);
  const [taking, setTaking] = useState(false);
  const [openingDoc, setOpeningDoc] = useState<DocumentType | null>(null);
  const [outcome, setOutcome] = useState<CallOutcome>("REACHED");
  const [notes, setNotes] = useState("");
  const [phone, setPhone] = useState("");
  const [opinion, setOpinion] = useState<Opinion>("RECOMMEND_APPROVE");
  const [note, setNote] = useState("");
  const [rejected, setRejected] = useState<number | null>(null);

  function open(next: Exclude<Dialog, null>) {
    setNotes("");
    setNote("");
    setPhone("");
    setDialog(next);
  }

  async function take() {
    setTaking(true);
    setActionError(null);
    try {
      await verificationApi.take(id);
      found.reload();
    } catch (err) {
      setActionError(err);
    } finally {
      setTaking(false);
    }
  }

  async function openDocument(type: DocumentType) {
    setOpeningDoc(type);
    setActionError(null);
    try {
      const link = await verificationApi.documentLink(id, type);
      // Signed, short-lived link: open it right away, never store it.
      window.open(link.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setActionError(err);
    } finally {
      setOpeningDoc(null);
    }
  }

  const done = () => found.reload();
  const inReview = c?.status === "IN_REVIEW";
  const mayWork = !!c && inReview && (isAdmin || c.reviewerId === me?.id);

  return (
    <>
      <Link href="/verification" className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground hover:underline">
        <ArrowLeft className="size-4" /> Vérifications
      </Link>
      <ErrorBanner error={found.error} />
      {found.loading && !c && <Spinner />}
      {c && (
        <>
          <PageHeader
            title={`Dossier ${c.type === "SELLER" ? "vendeur" : "livreur"} — ${c.user.name || c.user.email || c.user.phone || ""}`}
            description={c.id}
            actions={<StatusBadge value={c.status} />}
          />
          <div className="mb-4 grid gap-2">
            <ErrorBanner error={actionError} />
            {rejected !== null && (
              <Notice tone="warn">Dossier refusé. Essais restants pour le demandeur : {rejected}.</Notice>
            )}
            {c.previousRejections > 0 && (
              <Notice tone="warn">Ce demandeur a déjà {c.previousRejections} refus.</Notice>
            )}
            {c.samePlate.length > 0 && (
              <Notice tone="warn">
                Même plaque sur d&apos;autres dossiers :{" "}
                {c.samePlate.map((s) => `${s.user.name ?? s.user.id} (${s.status})`).join(", ")}
              </Notice>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card title="Demandeur et dossier">
              <dl className="divide-y divide-border">
                <Row label="Demandeur">
                  <Link href={`/users/${c.user.id}`} className="text-primary hover:underline">
                    {c.user.name || c.user.id}
                  </Link>
                </Row>
                <Row label="E-mail">{c.user.email ?? "—"}</Row>
                <Row label="Téléphone">{c.user.phone ?? "—"}</Row>
                <Row label="Essai n°">{c.attempt}</Row>
                <Row label="Déposé le">{formatDate(c.submittedAt)}</Row>
                {c.type === "SELLER" && <Row label="N° d'impôt">{c.taxNumber ?? "—"}</Row>}
                {c.type === "RIDER" && (
                  <>
                    <Row label="Véhicule">{c.vehicleType ?? "—"}</Row>
                    <Row label="Plaque">{c.plateNumber ?? "—"}</Row>
                  </>
                )}
                <Row label="Responsable">{c.reviewer?.name ?? "—"}</Row>
                <Row label="Avis">
                  <StatusBadge value={c.opinion} />
                </Row>
                {c.opinionNote && <Row label="Note d'avis">{c.opinionNote}</Row>}
                <Row label="Décision">
                  {c.decidedAt ? `${formatDate(c.decidedAt)} par ${c.decidedBy?.name ?? "—"}` : "—"}
                </Row>
                {c.decisionNote && <Row label="Note de décision">{c.decisionNote}</Row>}
              </dl>
            </Card>

            <Card title="Actions">
              <div className="grid gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button onClick={take} loading={taking} disabled={c.status !== "PENDING"}>
                    Prendre le dossier
                  </Button>
                  <Button variant="outline" disabled={!mayWork} onClick={() => open("call")}>
                    Journaliser un appel
                  </Button>
                  <Button variant="outline" disabled={!mayWork} onClick={() => open("opinion")}>
                    Donner un avis
                  </Button>
                </div>
                {!mayWork && inReview && (
                  <p className="text-xs text-muted-foreground">Ce dossier est suivi par un autre membre.</p>
                )}
                <div className="border-t border-border pt-3">
                  <p className="mb-2 text-xs font-medium text-muted-foreground uppercase">Décision (Administrateurs)</p>
                  {isAdmin ? (
                    <div className="flex gap-2">
                      <Button disabled={!inReview} onClick={() => open("approve")}>
                        Approuver
                      </Button>
                      <Button variant="danger" disabled={!inReview} onClick={() => open("reject")}>
                        Refuser
                      </Button>
                    </div>
                  ) : (
                    <Notice>L&apos;approbation et le refus sont réservés aux Administrateurs.</Notice>
                  )}
                </div>
              </div>
            </Card>
          </div>

          <Card title="Documents" className="mt-4">
            {c.documents.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun document.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Type</Th>
                    <Th>Format</Th>
                    <Th>Taille</Th>
                    <Th>Expire le</Th>
                    <Th />
                  </tr>
                </thead>
                <tbody>
                  {c.documents.map((d) => (
                    <tr key={d.id}>
                      <Td>
                        <span className="inline-flex items-center gap-2">
                          <FileText className="size-4" />
                          {d.type}
                        </span>
                      </Td>
                      <Td>{d.mimeType}</Td>
                      <Td>{Math.round(d.sizeBytes / 1024)} Ko</Td>
                      <Td>{formatDate(d.expiresAt)}</Td>
                      <Td>
                        <Button
                          size="sm"
                          variant="outline"
                          loading={openingDoc === d.type}
                          onClick={() => openDocument(d.type)}
                        >
                          <ExternalLink className="size-3.5" /> Ouvrir
                        </Button>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              Chaque ouverture crée un lien signé de courte durée et est journalisée.
            </p>
          </Card>

          <Card title="Appels" className="mt-4">
            {c.calls.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucun appel enregistré.</p>
            ) : (
              <Table>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Numéro</Th>
                    <Th>Résultat</Th>
                    <Th>Notes</Th>
                    <Th>Par</Th>
                  </tr>
                </thead>
                <tbody>
                  {c.calls.map((call) => (
                    <tr key={call.id}>
                      <Td className="whitespace-nowrap">{formatDate(call.calledAt)}</Td>
                      <Td>{call.phone}</Td>
                      <Td>
                        <StatusBadge value={call.outcome} />
                      </Td>
                      <Td>{call.notes ?? "—"}</Td>
                      <Td>{call.caller.name ?? "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          <FormDialog
            open={dialog === "call"}
            title="Journaliser un appel"
            submitLabel="Enregistrer"
            canSubmit={outcome !== "REACHED" || notes.trim().length > 0}
            onClose={() => setDialog(null)}
            onSubmit={async () => {
              await verificationApi.logCall(id, {
                outcome,
                notes: notes.trim() || undefined,
                phone: phone.trim() || undefined,
              });
              done();
            }}
          >
            <Field label="Résultat">
              <Select value={outcome} onChange={(e) => setOutcome(e.target.value as CallOutcome)}>
                {OUTCOMES.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="Numéro appelé (facultatif)" hint={`Par défaut : ${c.user.phone ?? "aucun"}. Format +243XXXXXXXXX`}>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
            </Field>
            <Field label="Compte rendu" hint={outcome === "REACHED" ? "Obligatoire si la personne a été jointe." : undefined}>
              <Textarea maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </Field>
          </FormDialog>

          <FormDialog
            open={dialog === "opinion"}
            title="Donner un avis"
            description="Recommander d'approuver exige un appel abouti ; recommander de refuser exige une explication."
            submitLabel="Enregistrer"
            canSubmit={opinion === "RECOMMEND_APPROVE" || note.trim().length > 0}
            onClose={() => setDialog(null)}
            onSubmit={async () => {
              await verificationApi.giveOpinion(id, { opinion, note: note.trim() || undefined });
              done();
            }}
          >
            <Field label="Avis">
              <Select value={opinion} onChange={(e) => setOpinion(e.target.value as Opinion)}>
                {OPINIONS.map((o) => (
                  <option key={o}>{o}</option>
                ))}
              </Select>
            </Field>
            <Field label="Note">
              <Textarea maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </FormDialog>

          <FormDialog
            open={dialog === "approve"}
            title="Approuver le dossier"
            description="Le demandeur sera averti."
            submitLabel="Approuver"
            onClose={() => setDialog(null)}
            onSubmit={async () => {
              await verificationApi.approve(id, note.trim() || undefined);
              done();
            }}
          >
            <Field label="Note (facultatif)">
              <Textarea maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </FormDialog>

          <FormDialog
            open={dialog === "reject"}
            title="Refuser le dossier"
            description="Cette explication est montrée au demandeur."
            submitLabel="Refuser"
            danger
            canSubmit={note.trim().length > 0}
            onClose={() => setDialog(null)}
            onSubmit={async () => {
              const result = await verificationApi.reject(id, note.trim());
              setRejected(result.attemptsLeft);
              done();
            }}
          >
            <Field label="Motif du refus">
              <Textarea required maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </FormDialog>
        </>
      )}
    </>
  );
}
