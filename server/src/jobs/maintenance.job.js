const { UnrecoverableError } = require("bullmq");
const { getPrisma } = require("../core/db/prisma");
const { getQueue, QUEUES } = require("../core/queue/queues");
const { logger } = require("../core/logger/logger");
const { authConfig } = require("../features/auth/config/auth.config");

const MAINTENANCE_JOBS = {
  CLEAN_UNCONFIRMED_SIGNUPS: "cleanup.unconfirmed-signups",
};

const HOUR = 60 * 60 * 1000;

async function cleanUnconfirmedSignups() {
  const cutoff = new Date(Date.now() - authConfig.unconfirmedSignupTtlMs);

  const { count } = await getPrisma().user.deleteMany({
    where: { status: "PENDING", updatedAt: { lt: cutoff } },
  });

  if (count) logger.info({ count }, "Deleted unconfirmed signups");
  return count;
}

const handlers = {
  [MAINTENANCE_JOBS.CLEAN_UNCONFIRMED_SIGNUPS]: cleanUnconfirmedSignups,
};

async function processMaintenance(job) {
  const handler = handlers[job.name];
  if (!handler) throw new UnrecoverableError(`Unknown maintenance job: ${job.name}`);
  await handler();
}

async function scheduleMaintenance() {
  await getQueue(QUEUES.MAINTENANCE).upsertJobScheduler(
    "cleanup-unconfirmed-signups",
    { every: HOUR },
    { name: MAINTENANCE_JOBS.CLEAN_UNCONFIRMED_SIGNUPS },
  );
}

module.exports = {
  MAINTENANCE_JOBS,
  cleanUnconfirmedSignups,
  processMaintenance,
  scheduleMaintenance,
};
