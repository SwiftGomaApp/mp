const { getPrisma } = require("../../../core/db/prisma");
const { AppError } = require("../../../core/errors/AppError");
const { emitToUser } = require("../../../core/realtime/emit");

const PUBLIC_FIELDS = {
  id: true,
  type: true,
  context: true,
  priority: true,
  title: true,
  body: true,
  data: true,
  readAt: true,
  acknowledgedAt: true,
  createdAt: true,
};

const notExpired = () => [{ expiresAt: null }, { expiresAt: { gt: new Date() } }];

function encodeCursor(item) {
  return Buffer.from(`${item.createdAt.toISOString()}|${item.id}`).toString("base64url");
}

function decodeCursor(cursor) {
  const invalid = () => AppError.badRequest("Curseur invalide", undefined, "INVALID_CURSOR");
  const [iso, id] = Buffer.from(cursor, "base64url").toString().split("|");
  const createdAt = new Date(iso);
  if (!id || Number.isNaN(createdAt.getTime())) throw invalid();
  return { createdAt, id };
}

function countUnread(userId) {
  return getPrisma().notification.count({
    where: { userId, readAt: null, OR: notExpired() },
  });
}

async function unreadSummary(userId) {
  const groups = await getPrisma().notification.groupBy({
    by: ["context"],
    where: { userId, readAt: null, OR: notExpired() },
    _count: { _all: true },
  });
  const byContext = Object.fromEntries(groups.map((g) => [g.context, g._count._all]));
  const unreadCount = groups.reduce((sum, g) => sum + g._count._all, 0);
  return { unreadCount, byContext };
}

async function listNotifications(userId, { cursor, limit, context, unread }) {
  const and = [{ OR: notExpired() }];
  if (cursor) {
    const c = decodeCursor(cursor);
    and.push({
      OR: [{ createdAt: { lt: c.createdAt } }, { createdAt: c.createdAt, id: { lt: c.id } }],
    });
  }

  const rows = await getPrisma().notification.findMany({
    where: {
      userId,
      AND: and,
      ...(context ? { context } : {}),
      ...(unread ? { readAt: null } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    select: PUBLIC_FIELDS,
  });

  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;

  return {
    items,
    nextCursor: hasMore ? encodeCursor(items.at(-1)) : null,
    unreadCount: await countUnread(userId),
  };
}

async function markRead(userId, id) {
  const prisma = getPrisma();
  const now = new Date();

  const { count } = await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: now },
  });

  let readAt = now;
  if (!count) {
    const existing = await prisma.notification.findFirst({
      where: { id, userId },
      select: { readAt: true },
    });
    if (!existing) throw AppError.notFound("Notification introuvable", "NOTIFICATION_NOT_FOUND");
    readAt = existing.readAt;
  }

  const unreadCount = await countUnread(userId);
  if (count) emitToUser(userId, "notification:read", { ids: [id], unreadCount });
  return { id, readAt, unreadCount };
}

async function acknowledge(userId, id) {
  const prisma = getPrisma();
  const existing = await prisma.notification.findFirst({
    where: { id, userId },
    select: { readAt: true, acknowledgedAt: true },
  });
  if (!existing) throw AppError.notFound("Notification introuvable", "NOTIFICATION_NOT_FOUND");

  const now = new Date();
  const becameRead = !existing.readAt;

  await prisma.notification.update({
    where: { id },
    data: {
      acknowledgedAt: existing.acknowledgedAt ?? now,
      readAt: existing.readAt ?? now,
    },
  });

  const unreadCount = await countUnread(userId);
  if (becameRead) emitToUser(userId, "notification:read", { ids: [id], unreadCount });
  return { id, acknowledgedAt: existing.acknowledgedAt ?? now, unreadCount };
}

async function markAllRead(userId, { context } = {}) {
  const { count } = await getPrisma().notification.updateMany({
    where: { userId, readAt: null, ...(context ? { context } : {}) },
    data: { readAt: new Date() },
  });

  const unreadCount = await countUnread(userId);
  if (count) {
    emitToUser(userId, "notification:read", { all: true, context: context ?? null, unreadCount });
  }
  return { updated: count, unreadCount };
}

async function removeNotification(userId, id) {
  const { count } = await getPrisma().notification.deleteMany({ where: { id, userId } });
  if (!count) throw AppError.notFound("Notification introuvable", "NOTIFICATION_NOT_FOUND");

  const unreadCount = await countUnread(userId);
  emitToUser(userId, "notification:deleted", { ids: [id], unreadCount });
  return { id, unreadCount };
}

module.exports = {
  countUnread,
  unreadSummary,
  listNotifications,
  markRead,
  acknowledge,
  markAllRead,
  removeNotification,
};
