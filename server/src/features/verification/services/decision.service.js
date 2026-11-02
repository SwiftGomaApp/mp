const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { logger } = require("../../../core/logger/logger");
const { notify } = require("../../notifications/notify");
const { logActivity } = require("../../auth/services/activity.service");
const { verificationConfig: cfg } = require("../config/verification.config");
const { canTransition, hasReachedPerson } = require("../utils/verification.utils");

// `actor` is { userId, role }, taken from req.auth.
function assertDecider(actor) {
  if (!cfg.deciderRoles.includes(actor.role)) throw AppError.forbidden();
}

async function loadCase(caseId) {
  const found = await getPrisma().verificationCase.findUnique({
    where: { id: caseId },
    include: { calls: true },
  });
  if (!found) throw AppError.notFound("Dossier introuvable", "CASE_NOT_FOUND");
  return found;
}

// Moves the case and the user's summary status together, only if still IN_REVIEW.
async function settle(c, actor, status, note) {
  const settled = await getPrisma().$transaction(async (tx) => {
    const result = await tx.verificationCase.updateMany({
      where: { id: c.id, status: "IN_REVIEW" },
      data: { status, decidedById: actor.userId, decidedAt: new Date(), decisionNote: note },
    });
    if (result.count !== 1) return false;

    await tx.user.update({ where: { id: c.userId }, data: { verificationStatus: status } });
    return true;
  });

  if (!settled) {
    throw AppError.conflict("Ce dossier a déjà été traité", "CASE_ALREADY_DECIDED");
  }
}

async function tell(userId, event, data) {
  try {
    await notify({ event, userId, data });
  } catch (err) {
    logger.warn({ err, event }, "Failed to notify verification decision");
  }
}

async function approveCase({ caseId, actor, note }, meta) {
  assertDecider(actor);
  const c = await loadCase(caseId);

  if (!canTransition(c.status, "APPROVED")) {
    throw AppError.conflict("Ce dossier n'est pas en cours d'examen", "CASE_NOT_IN_REVIEW");
  }
  // the call is required for both roles, whatever the opinion says
  if (!hasReachedPerson(c.calls)) {
    throw AppError.conflict("La personne n'a pas encore été jointe par téléphone", "CALL_REQUIRED");
  }

  await settle(c, actor, "APPROVED", note?.trim() || null);

  await logActivity({
    userId: c.userId,
    event: "VERIFICATION_APPROVED",
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { caseId: c.id, actorId: actor.userId },
  });
  await tell(c.userId, "verification.approved", { caseId: c.id });
}

async function rejectCase({ caseId, actor, note }, meta) {
  assertDecider(actor);
  const c = await loadCase(caseId);

  if (!canTransition(c.status, "REJECTED")) {
    throw AppError.conflict("Ce dossier n'est pas en cours d'examen", "CASE_NOT_IN_REVIEW");
  }
  // the explanation is shown to the applicant, so it cannot be empty
  if (!note?.trim()) throw AppError.badRequest("Expliquez le refus", undefined, "NOTE_REQUIRED");

  await settle(c, actor, "REJECTED", note.trim());

  const refused = await getPrisma().verificationCase.count({
    where: { userId: c.userId, status: "REJECTED" },
  });
  const attemptsLeft = Math.max(cfg.maxAttempts - refused, 0);

  await logActivity({
    userId: c.userId,
    event: "VERIFICATION_REJECTED",
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { caseId: c.id, actorId: actor.userId, attemptsLeft },
  });
  await tell(c.userId, "verification.rejected", { caseId: c.id, attemptsLeft });

  return { attemptsLeft };
}

module.exports = { approveCase, rejectCase };
