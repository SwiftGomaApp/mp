const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { logActivity } = require("./activity.service");
const { revokeUserSessions } = require("./session.service");

async function setStatus({ userId, actorId, status, reason, event, sessionReason }, meta) {
  if (userId === actorId) {
    throw AppError.forbidden("Vous ne pouvez pas modifier votre propre compte", "SELF_ACTION");
  }

  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.status === "DELETED") {
    throw AppError.notFound("Compte introuvable", "ACCOUNT_NOT_FOUND");
  }

  await prisma.user.update({ where: { id: userId }, data: { status } });
  if (sessionReason) await revokeUserSessions(userId, { reason: sessionReason });

  await logActivity({
    userId,
    event,
    ipAddress: meta?.ipAddress,
    userAgent: meta?.userAgent,
    metadata: { actorId, reason, previousStatus: user.status },
  });
}

async function suspendAccount({ userId, actorId, reason }, meta) {
  await setStatus(
    {
      userId,
      actorId,
      reason,
      status: "SUSPENDED",
      event: "ACCOUNT_SUSPENDED",
      sessionReason: "SUSPENDED",
    },
    meta,
  );
}

async function banAccount({ userId, actorId, reason }, meta) {
  await setStatus(
    { userId, actorId, reason, status: "BANNED", event: "ACCOUNT_BANNED", sessionReason: "BANNED" },
    meta,
  );
}

async function reactivateAccount({ userId, actorId, reason }, meta) {
  const user = await getPrisma().user.findUnique({ where: { id: userId } });
  if (!user || !["SUSPENDED", "BANNED"].includes(user.status)) {
    throw AppError.conflict("Ce compte n'est pas suspendu", "ACCOUNT_NOT_SUSPENDED");
  }
  await setStatus(
    { userId, actorId, reason, status: "ACTIVE", event: "ACCOUNT_REACTIVATED" },
    meta,
  );
  await getPrisma().supportRequest.updateMany({
    where: { userId, status: "OPEN" },
    data: { status: "CLOSED", closedBy: actorId, closedAt: new Date(), note: "Compte réactivé" },
  });
}

module.exports = { suspendAccount, banAccount, reactivateAccount };
