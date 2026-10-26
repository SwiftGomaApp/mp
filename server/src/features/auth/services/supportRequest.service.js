const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { logActivity } = require("./activity.service");

const DAY = 24 * 60 * 60 * 1000;
const RESPONSE_MESSAGE =
  "Si ce compte est suspendu, votre message a été transmis au Support. Vous serez contacté.";

async function createSupportRequest({ email, phone, message }, meta) {
  const prisma = getPrisma();

  const user = await prisma.user.findFirst({
    where: email ? { email } : { phone },
    select: { id: true, status: true },
  });

  if (!user || !["SUSPENDED", "BANNED"].includes(user.status)) {
    return { message: RESPONSE_MESSAGE };
  }

  const recent = await prisma.supportRequest.findFirst({
    where: {
      userId: user.id,
      status: "OPEN",
      createdAt: { gt: new Date(Date.now() - DAY) },
    },
    select: { id: true },
  });
  if (recent) return { message: RESPONSE_MESSAGE };

  await prisma.supportRequest.create({
    data: { userId: user.id, message, ipAddress: meta.ipAddress },
  });

  await logActivity({
    userId: user.id,
    event: "SUPPORT_REQUEST_CREATED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
  });

  return { message: RESPONSE_MESSAGE };
}

async function listSupportRequests({ status, page, limit }) {
  const prisma = getPrisma();
  const where = { status };

  const [items, total] = await Promise.all([
    prisma.supportRequest.findMany({
      where,
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        message: true,
        status: true,
        note: true,
        closedBy: true,
        closedAt: true,
        createdAt: true,
        user: {
          select: { id: true, name: true, email: true, phone: true, role: true, status: true },
        },
      },
    }),
    prisma.supportRequest.count({ where }),
  ]);

  return { items, page, limit, total };
}

async function closeSupportRequest({ actorId, id, note }, meta) {
  const prisma = getPrisma();

  const { count } = await prisma.supportRequest.updateMany({
    where: { id, status: "OPEN" },
    data: { status: "CLOSED", closedBy: actorId, closedAt: new Date(), note: note ?? null },
  });
  if (count !== 1) {
    throw AppError.notFound("Demande introuvable ou déjà clôturée", "SUPPORT_REQUEST_NOT_FOUND");
  }

  const request = await prisma.supportRequest.findUnique({
    where: { id },
    select: { userId: true },
  });

  await logActivity({
    userId: request.userId,
    event: "SUPPORT_REQUEST_CLOSED",
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    metadata: { actorId, requestId: id },
  });

  return { id, status: "CLOSED" };
}

module.exports = { createSupportRequest, listSupportRequests, closeSupportRequest };
