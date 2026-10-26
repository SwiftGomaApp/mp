const { UnrecoverableError } = require("bullmq");
const { getPrisma } = require("../core/db/prisma");
const { getQueue, QUEUES } = require("../core/queue/queues");
const { logger } = require("../core/logger/logger");
const { authConfig } = require("../features/auth/config/auth.config");

const MAINTENANCE_JOBS = {
  CLEAN_UNCONFIRMED_SIGNUPS: "cleanup.unconfirmed-signups",
  CLEAN_EXPIRED_DATA: "cleanup.expired-data",
};

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function cleanUnconfirmedSignups() {
  const cutoff = new Date(Date.now() - authConfig.unconfirmedSignupTtlMs);

  const { count } = await getPrisma().user.deleteMany({
    where: { status: "PENDING", updatedAt: { lt: cutoff } },
  });

  if (count) logger.info({ count }, "Deleted unconfirmed signups");
  return count;
}

async function cleanExpiredData() {
  const prisma = getPrisma();
  const { retention } = authConfig;
  const ago = (ms) => new Date(Date.now() - ms);
  const now = new Date();

  const sessions = await prisma.session.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: ago(retention.sessionsMs) } },
        { revokedAt: { lt: ago(retention.sessionsMs) } },
      ],
    },
  });

  const logs = await prisma.activityLog.deleteMany({
    where: { createdAt: { lt: ago(retention.activityLogsMs) } },
  });

  await prisma.accountRecoveryRequest.updateMany({
    where: { status: "PENDING", expiresAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
  const recoveries = await prisma.accountRecoveryRequest.deleteMany({
    where: { status: { not: "PENDING" }, updatedAt: { lt: ago(retention.recoveryRequestsMs) } },
  });

  logger.info(
    { sessions: sessions.count, activityLogs: logs.count, recoveryRequests: recoveries.count },
    "Deleted expired data",
  );
}

const handlers = {
  [MAINTENANCE_JOBS.CLEAN_UNCONFIRMED_SIGNUPS]: cleanUnconfirmedSignups,
  [MAINTENANCE_JOBS.CLEAN_EXPIRED_DATA]: cleanExpiredData,
};

async function processMaintenance(job) {
  const handler = handlers[job.name];
  if (!handler) throw new UnrecoverableError(`Unknown maintenance job: ${job.name}`);
  await handler();
}

async function scheduleMaintenance() {
  const queue = getQueue(QUEUES.MAINTENANCE);

  await queue.upsertJobScheduler(
    "cleanup-unconfirmed-signups",
    { every: HOUR },
    { name: MAINTENANCE_JOBS.CLEAN_UNCONFIRMED_SIGNUPS },
  );
  await queue.upsertJobScheduler(
    "cleanup-expired-data",
    { every: DAY },
    { name: MAINTENANCE_JOBS.CLEAN_EXPIRED_DATA },
  );
}

module.exports = {
  MAINTENANCE_JOBS,
  cleanUnconfirmedSignups,
  cleanExpiredData,
  processMaintenance,
  scheduleMaintenance,
};
