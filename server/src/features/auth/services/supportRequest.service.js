const { getPrisma } = require("../../../core/db/prisma");
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

module.exports = { createSupportRequest };
