const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");

async function listSuppressions({ page, limit, reason, search }) {
  const prisma = getPrisma();
  const where = {
    ...(reason ? { reason } : {}),
    ...(search ? { email: { contains: search.toLowerCase() } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.emailSuppression.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.emailSuppression.count({ where }),
  ]);
  return { items, page, limit, total };
}

/**
 * Records an address that bounced or complained. Plain SMTP gives no automatic bounce
 * feed, so an admin enters these. The account's marketing consent is switched off too.
 */
async function addSuppression({ email, reason }) {
  const prisma = getPrisma();
  const normalized = email.trim().toLowerCase();

  const user = await prisma.user.findFirst({ where: { email: normalized }, select: { id: true } });

  const row = await prisma.emailSuppression.upsert({
    where: { email: normalized },
    create: { email: normalized, reason, userId: user?.id ?? null, source: "admin" },
    update: { reason, source: "admin" },
  });

  await prisma.notificationSettings.updateMany({
    where: { user: { email: normalized } },
    data: { marketingEmailOptIn: false, marketingEmailOptedAt: null },
  });

  return row;
}

/**
 * Only a bounce can be lifted by an admin, for example once the mailbox is fixed. People who
 * unsubscribed or complained must opt back in themselves.
 */
async function removeSuppression(id) {
  const prisma = getPrisma();
  const row = await prisma.emailSuppression.findUnique({ where: { id } });
  if (!row) throw AppError.notFound("Adresse introuvable", "SUPPRESSION_NOT_FOUND");

  if (row.reason !== "BOUNCED") {
    throw AppError.conflict(
      "Seule une adresse en échec de livraison peut être réactivée par un administrateur",
      "SUPPRESSION_LOCKED",
    );
  }

  await prisma.emailSuppression.delete({ where: { id } });
  return { id };
}

async function listRecipients(campaignId, { page, limit, status }) {
  const prisma = getPrisma();
  const where = { campaignId, ...(status ? { status } : {}) };

  const [items, total] = await Promise.all([
    prisma.campaignRecipient.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        userId: true,
        email: true,
        status: true,
        skipReason: true,
        error: true,
        sentAt: true,
      },
    }),
    prisma.campaignRecipient.count({ where }),
  ]);
  return { items, page, limit, total };
}

module.exports = { listSuppressions, addSuppression, removeSuppression, listRecipients };
