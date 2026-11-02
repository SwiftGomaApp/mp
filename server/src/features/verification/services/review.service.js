const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { isValidDrcPhone } = require("../../../core/validation/phone");
const { logActivity } = require("../../auth/services/activity.service");
const { verificationConfig: cfg } = require("../config/verification.config");
const { documentViewUrl } = require("../utils/verification.storage");
const {
  canTransition,
  hasReachedPerson,
  toPublicCase,
} = require("../utils/verification.utils");

const OPEN_STATUSES = ["PENDING", "IN_REVIEW"];

function assertStaff(actor) {
  if (!cfg.reviewerRoles.includes(actor.role)) throw AppError.forbidden();
}

async function loadCase(caseId, include) {
  const found = await getPrisma().verificationCase.findUnique({ where: { id: caseId }, include });
  if (!found) throw AppError.notFound("Dossier introuvable", "CASE_NOT_FOUND");
  return found;
}

function assertCanWork(c, actor) {
  if (c.status !== "IN_REVIEW") {
    throw AppError.conflict("Ce dossier n'est pas en cours d'examen", "CASE_NOT_IN_REVIEW");
  }
  if (actor.role !== "ADMIN" && c.reviewerId !== actor.userId) {
    throw AppError.forbidden("Ce dossier est suivi par un autre membre", "NOT_YOUR_CASE");
  }
}

function logCaseEvent(c, event, meta, metadata) {
  return logActivity({
    userId: c.userId,
    event,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { caseId: c.id, ...metadata },
  });
}

async function listCases({ actor, page, limit, status, type, q, mine }) {
  assertStaff(actor);
  const prisma = getPrisma();

  const where = {
    status: status ?? { in: OPEN_STATUSES },
    ...(type && { type }),
    ...(mine && { reviewerId: actor.userId }),
    ...(q && {
      user: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { email: { contains: q, mode: "insensitive" } },
          { phone: { contains: q } },
        ],
      },
    }),
  };

  const [total, items] = await Promise.all([
    prisma.verificationCase.count({ where }),
    prisma.verificationCase.findMany({
      where,
      orderBy: { submittedAt: "asc" }, // oldest first
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        type: true,
        status: true,
        attempt: true,
        submittedAt: true,
        opinion: true,
        user: { select: { id: true, name: true, phone: true, email: true } },
        reviewer: { select: { id: true, name: true } },
        _count: { select: { documents: true, calls: true } },
      },
    }),
  ]);

  return { items, page, limit, total };
}

async function getCase({ caseId, actor }) {
  assertStaff(actor);
  const c = await loadCase(caseId, {
    user: {
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true },
    },
    documents: true,
    calls: {
      orderBy: { calledAt: "asc" },
      include: { caller: { select: { id: true, name: true } } },
    },
    reviewer: { select: { id: true, name: true } },
    decidedBy: { select: { id: true, name: true } },
  });

  const prisma = getPrisma();
  const [previousRejections, samePlate] = await Promise.all([
    prisma.verificationCase.count({ where: { userId: c.userId, status: "REJECTED" } }),
    // the same plate on another person's dossier is worth a look
    c.plateNumber
      ? prisma.verificationCase.findMany({
          where: { plateNumber: c.plateNumber, userId: { not: c.userId } },
          select: { id: true, status: true, user: { select: { id: true, name: true } } },
        })
      : [],
  ]);

  // storageId is removed from documents here, staff open them through viewDocument
  return { ...toPublicCase(c), previousRejections, samePlate };
}

async function takeCase({ caseId, actor }, meta) {
  assertStaff(actor);
  const c = await loadCase(caseId);

  if (!canTransition(c.status, "IN_REVIEW")) {
    throw AppError.conflict("Ce dossier n'est pas en attente", "CASE_NOT_PENDING");
  }

  const taken = await getPrisma().$transaction(async (tx) => {
    // only succeeds if nobody took it in the meantime
    const result = await tx.verificationCase.updateMany({
      where: { id: caseId, status: "PENDING" },
      data: { status: "IN_REVIEW", reviewerId: actor.userId },
    });
    if (result.count !== 1) return false;

    await tx.user.update({ where: { id: c.userId }, data: { verificationStatus: "IN_REVIEW" } });
    return true;
  });

  if (!taken) throw AppError.conflict("Ce dossier est déjà pris", "CASE_ALREADY_TAKEN");

  await logCaseEvent(c, "VERIFICATION_TAKEN", meta, { actorId: actor.userId });
}

async function logCall({ caseId, actor, outcome, notes, phone }, meta) {
  assertStaff(actor);
  const c = await loadCase(caseId, { user: { select: { phone: true } } });
  assertCanWork(c, actor);

  const dialled = phone ?? c.user.phone;
  if (!dialled || !isValidDrcPhone(dialled)) {
    throw AppError.badRequest("Indiquez le numéro appelé", undefined, "PHONE_REQUIRED");
  }
  if (outcome === "REACHED" && !notes?.trim()) {
    throw AppError.badRequest("Notez le compte rendu de l'appel", undefined, "NOTES_REQUIRED");
  }

  const call = await getPrisma().verificationCall.create({
    data: {
      caseId,
      callerId: actor.userId,
      phone: dialled,
      outcome,
      notes: notes?.trim() || null,
    },
  });

  await logCaseEvent(c, "VERIFICATION_CALL_LOGGED", meta, { actorId: actor.userId, outcome });
  return call;
}

async function giveOpinion({ caseId, actor, opinion, note }, meta) {
  assertStaff(actor);
  const c = await loadCase(caseId, { calls: true });
  assertCanWork(c, actor);

  if (opinion === "RECOMMEND_APPROVE" && !hasReachedPerson(c.calls)) {
    throw AppError.conflict("Appelez d'abord la personne", "CALL_REQUIRED");
  }
  if (opinion === "RECOMMEND_REJECT" && !note?.trim()) {
    throw AppError.badRequest("Expliquez pourquoi", undefined, "NOTE_REQUIRED");
  }

  const updated = await getPrisma().verificationCase.update({
    where: { id: caseId },
    data: { opinion, opinionNote: note?.trim() || null, reviewedAt: new Date() },
    select: { id: true, opinion: true, opinionNote: true, reviewedAt: true },
  });

  await logCaseEvent(c, "VERIFICATION_OPINION_GIVEN", meta, { actorId: actor.userId, opinion });
  return updated;
}

async function viewDocument({ caseId, type, actor }, meta) {
  assertStaff(actor);
  const c = await loadCase(caseId, { documents: true });

  const doc = c.documents.find((d) => d.type === type);
  if (!doc) throw AppError.notFound("Document introuvable", "DOCUMENT_NOT_FOUND");

  // Logged first: no document is opened without a record of who opened it.
  await logCaseEvent(c, "VERIFICATION_DOCUMENT_VIEWED", meta, { actorId: actor.userId, type });

  return {
    url: documentViewUrl(doc.storageId),
    mimeType: doc.mimeType,
    expiresInSeconds: cfg.signedUrlTtlSeconds,
  };
}

module.exports = { listCases, getCase, takeCase, logCall, giveOpinion, viewDocument };
