const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");

const MARKETING_ROLES = ["BUYER", "SELLER", "RIDER"];
const DAY = 24 * 60 * 60 * 1000;
const PAGE_SIZE = 500;

/**
 * Turns segment rules into a user filter. Whatever the rules say, the audience is always
 * limited to active customers (never staff) with a verified email who opted in to marketing.
 */
function buildAudienceWhere(rules = {}, now = new Date()) {
  const daysAgo = (days) => new Date(now.getTime() - days * DAY);
  const roles = rules.roles?.filter((role) => MARKETING_ROLES.includes(role));

  const where = {
    status: "ACTIVE",
    role: { in: roles?.length ? roles : MARKETING_ROLES },
    email: { not: null },
    emailVerifiedAt: { not: null },
    notificationSettings: { is: { marketingEmailOptIn: true } },
  };
  const and = [];

  if (rules.platforms?.length || rules.cities?.length) {
    const session = {};
    if (rules.platforms?.length) session.platform = { in: rules.platforms };
    if (rules.cities?.length) {
      session.OR = rules.cities.map((city) => ({ city: { equals: city, mode: "insensitive" } }));
    }
    where.sessions = { some: session };
  }
  if (rules.lastLoginWithinDays) {
    and.push({ lastLoginAt: { gte: daysAgo(rules.lastLoginWithinDays) } });
  }
  if (rules.inactiveForDays) {
    and.push({
      OR: [{ lastLoginAt: null }, { lastLoginAt: { lt: daysAgo(rules.inactiveForDays) } }],
    });
  }
  if (rules.signedUpWithinDays) {
    and.push({ createdAt: { gte: daysAgo(rules.signedUpWithinDays) } });
  }
  if (rules.verificationStatuses?.length) {
    where.verificationStatus = { in: rules.verificationStatuses };
  }
  if (and.length) where.AND = and;

  return where;
}

async function previewAudience(rules) {
  const prisma = getPrisma();
  const where = buildAudienceWhere(rules);
  const [count, sample] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({ where, take: 5, orderBy: { id: "asc" }, select: { name: true, role: true } }),
  ]);
  return { count, sample };
}

async function* iterateAudience(rules, pageSize = PAGE_SIZE) {
  const prisma = getPrisma();
  const where = buildAudienceWhere(rules);
  let cursor = null;

  for (;;) {
    const page = await prisma.user.findMany({
      where,
      orderBy: { id: "asc" },
      take: pageSize,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      select: { id: true, name: true, email: true },
    });
    if (!page.length) return;
    yield page;
    if (page.length < pageSize) return;
    cursor = page.at(-1).id;
  }
}

const notFound = () => AppError.notFound("Segment introuvable", "SEGMENT_NOT_FOUND");

async function createSegment({ name, description, rules }, actorId) {
  return getPrisma().segment.create({
    data: { name, description: description ?? null, rules, createdBy: actorId },
  });
}

async function listSegments({ page, limit }) {
  const prisma = getPrisma();
  const [items, total] = await Promise.all([
    prisma.segment.findMany({
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.segment.count(),
  ]);
  return { items, page, limit, total };
}

async function getSegment(id) {
  const segment = await getPrisma().segment.findUnique({ where: { id } });
  if (!segment) throw notFound();
  return segment;
}

async function updateSegment(id, patch) {
  await getSegment(id);
  return getPrisma().segment.update({ where: { id }, data: patch });
}

async function deleteSegment(id) {
  const prisma = getPrisma();
  await getSegment(id);

  const inUse = await prisma.campaign.count({
    where: { segmentId: id, status: { in: ["SCHEDULED", "SENDING"] } },
  });
  if (inUse) {
    throw AppError.conflict(
      "Ce segment est utilisé par une campagne programmée ou en cours",
      "SEGMENT_IN_USE",
    );
  }

  await prisma.segment.delete({ where: { id } });
  return { id };
}

module.exports = {
  MARKETING_ROLES,
  buildAudienceWhere,
  previewAudience,
  iterateAudience,
  createSegment,
  listSegments,
  getSegment,
  updateSegment,
  deleteSegment,
};
