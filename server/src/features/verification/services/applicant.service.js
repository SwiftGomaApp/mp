const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { logActivity } = require("../../auth/services/activity.service");
const { verificationConfig: cfg } = require("../config/verification.config");
const { storeDocument, removeStoredDocument } = require("../utils/verification.storage");
const {
  normalizePlate,
  allowedDocumentTypes,
  checkSubmission,
} = require("../utils/verification.utils");

const VERIFIABLE_ROLES = ["SELLER", "RIDER"];

function applicantView(c) {
  if (!c) return null;
  const decided = c.status === "APPROVED" || c.status === "REJECTED";
  return {
    id: c.id,
    type: c.type,
    status: c.status,
    attempt: c.attempt,
    taxNumber: c.taxNumber,
    vehicleType: c.vehicleType,
    plateNumber: c.plateNumber,
    submittedAt: c.submittedAt,
    decidedAt: c.decidedAt,
    decisionNote: decided ? c.decisionNote : null,
    documents: c.documents.map(({ type, mimeType, sizeBytes, expiresAt, createdAt }) => ({
      type,
      mimeType,
      sizeBytes,
      expiresAt,
      createdAt,
    })),
  };
}

async function requireDraft(userId) {
  const draft = await getPrisma().verificationCase.findFirst({
    where: { userId, status: "NOT_SUBMITTED" },
    include: { documents: true },
  });
  if (!draft) {
    throw AppError.conflict("Commencez d'abord votre dossier", "NO_DRAFT_CASE");
  }
  return draft;
}

async function getMyCase(userId) {
  const prisma = getPrisma();
  const [user, latest, rejected] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, verificationStatus: true },
    }),
    prisma.verificationCase.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { documents: true },
    }),
    prisma.verificationCase.count({ where: { userId, status: "REJECTED" } }),
  ]);

  const rules = cfg.documents[user.role];
  const sent = new Set(latest?.documents.map((d) => d.type));

  return {
    verificationStatus: user.verificationStatus,
    attemptsLeft: Math.max(0, cfg.maxAttempts - rejected),
    checklist: rules && {
      required: rules.required.map((type) => ({ type, sent: sent.has(type) })),
      optional: rules.optional.map((type) => ({ type, sent: sent.has(type) })),
    },
    case: applicantView(latest),
  };
}

async function startCase(userId) {
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, verificationStatus: true },
  });

  if (!VERIFIABLE_ROLES.includes(user.role)) {
    throw AppError.forbidden("Votre compte n'a pas de dossier à vérifier", "NOT_VERIFIABLE");
  }
  if (user.verificationStatus === "APPROVED") {
    throw AppError.conflict("Votre dossier est déjà approuvé", "ALREADY_APPROVED");
  }
  if (["PENDING", "IN_REVIEW"].includes(user.verificationStatus)) {
    throw AppError.conflict("Votre dossier est en cours d'examen", "CASE_IN_PROGRESS");
  }

  const existing = await prisma.verificationCase.findFirst({
    where: { userId, status: "NOT_SUBMITTED" },
    include: { documents: true },
  });
  if (existing) return applicantView(existing);

  const rejected = await prisma.verificationCase.count({ where: { userId, status: "REJECTED" } });
  if (rejected >= cfg.maxAttempts) {
    throw AppError.forbidden(
      "Vous avez utilisé vos 3 essais, veuillez contacter le Support",
      "ATTEMPTS_EXHAUSTED",
    );
  }

  const created = await prisma.verificationCase.create({
    data: { userId, type: user.role, status: "NOT_SUBMITTED", attempt: rejected + 1 },
    include: { documents: true },
  });
  return applicantView(created);
}

async function saveDetails({ userId, taxNumber, vehicleType, plateNumber }) {
  const draft = await requireDraft(userId);
  const data = {};

  if (draft.type === "SELLER") {
    if (vehicleType !== undefined || plateNumber !== undefined) {
      throw AppError.badRequest(
        "Ces informations ne concernent pas un vendeur",
        undefined,
        "FIELD_NOT_ALLOWED",
      );
    }
    if (taxNumber !== undefined) data.taxNumber = taxNumber;
  } else {
    if (taxNumber !== undefined) {
      throw AppError.badRequest(
        "Ces informations ne concernent pas un livreur",
        undefined,
        "FIELD_NOT_ALLOWED",
      );
    }
    if (vehicleType !== undefined) data.vehicleType = vehicleType;
    if (plateNumber !== undefined) {
      const plate = normalizePlate(plateNumber);
      if (plate.length < cfg.plate.minLength || plate.length > cfg.plate.maxLength) {
        throw AppError.badRequest("Numéro de plaque invalide", undefined, "PLATE_INVALID");
      }
      data.plateNumber = plate;
    }
  }

  const updated = await getPrisma().verificationCase.update({
    where: { id: draft.id },
    data,
    include: { documents: true },
  });
  return applicantView(updated);
}

async function uploadDocument({ userId, type, file, expiresAt }) {
  const draft = await requireDraft(userId);

  if (!allowedDocumentTypes(draft.type).includes(type)) {
    throw AppError.badRequest("Ce document n'est pas demandé", undefined, "DOCUMENT_NOT_ALLOWED");
  }
  if (cfg.file.imageOnly.includes(type) && !cfg.file.imageMimeTypes.includes(file.mimetype)) {
    throw new AppError(415, "INVALID_FILE_TYPE", "Une photo est attendue pour ce document");
  }

  let expiry = null;
  if (cfg.expiryRequired.includes(type)) {
    if (!expiresAt) {
      throw AppError.badRequest(
        "Indiquez la date de fin de ce document",
        undefined,
        "EXPIRY_REQUIRED",
      );
    }
    if (expiresAt <= new Date()) {
      throw AppError.badRequest("Ce document a expiré", undefined, "DOCUMENT_EXPIRED");
    }
    expiry = expiresAt;
  }

  const storageId = await storeDocument({ buffer: file.buffer, caseId: draft.id, type });

  const data = { storageId, mimeType: file.mimetype, sizeBytes: file.size, expiresAt: expiry };
  const doc = await getPrisma().verificationDocument.upsert({
    where: { caseId_type: { caseId: draft.id, type } },
    create: { caseId: draft.id, type, ...data },
    update: data,
  });

  return {
    type: doc.type,
    mimeType: doc.mimeType,
    sizeBytes: doc.sizeBytes,
    expiresAt: doc.expiresAt,
  };
}

async function removeDocument({ userId, type }) {
  const draft = await requireDraft(userId);
  const doc = draft.documents.find((d) => d.type === type);
  if (!doc) throw AppError.notFound("Document introuvable", "DOCUMENT_NOT_FOUND");

  await removeStoredDocument(doc.storageId);
  await getPrisma().verificationDocument.delete({ where: { id: doc.id } });
}

async function purgeRejectedDocuments(userId) {
  const prisma = getPrisma();
  const old = await prisma.verificationDocument.findMany({
    where: { case: { userId, status: "REJECTED" } },
    select: { id: true, storageId: true },
  });
  await Promise.all(old.map((d) => removeStoredDocument(d.storageId)));
  if (old.length) {
    await prisma.verificationDocument.deleteMany({ where: { id: { in: old.map((d) => d.id) } } });
  }
}

async function submitCase(userId, meta = {}) {
  const prisma = getPrisma();
  const draft = await requireDraft(userId);

  const problems = checkSubmission({
    type: draft.type,
    documents: draft.documents,
    taxNumber: draft.taxNumber,
    vehicleType: draft.vehicleType,
    plateNumber: draft.plateNumber,
  });
  if (problems.length) {
    throw new AppError(422, "VERIFICATION_INCOMPLETE", "Votre dossier est incomplet", problems);
  }

  try {
    await prisma.$transaction([
      prisma.verificationCase.update({
        where: { id: draft.id },
        data: { status: "PENDING", submittedAt: new Date() },
      }),
      prisma.user.update({ where: { id: userId }, data: { verificationStatus: "PENDING" } }),
    ]);
  } catch (err) {
    // the one-open-case-per-user index
    if (err.code === "P2002") {
      throw AppError.conflict("Un dossier est déjà en cours d'examen", "CASE_IN_PROGRESS");
    }
    throw err;
  }

  await logActivity({
    userId,
    event: "VERIFICATION_SUBMITTED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { caseId: draft.id, attempt: draft.attempt },
  });
  await purgeRejectedDocuments(userId);

  return getMyCase(userId);
}

module.exports = { getMyCase, startCase, saveDetails, uploadDocument, removeDocument, submitCase };
