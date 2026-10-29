const { UnrecoverableError } = require("bullmq");
const { getQueue, QUEUES } = require("../core/queue/queues");
const { MARKETING_JOBS } = require("../core/queue/marketing");
const { startCampaign, sendBatch, dispatchDue } = require("../features/marketing/services/sender.service");

const handlers = {
  [MARKETING_JOBS.START]: startCampaign,
  [MARKETING_JOBS.BATCH]: sendBatch,
  [MARKETING_JOBS.DISPATCH_DUE]: dispatchDue,
};

async function processMarketing(job) {
  const handler = handlers[job.name];
  if (!handler) throw new UnrecoverableError(`Unknown marketing job: ${job.name}`);
  await handler(job.data);
}

async function scheduleMarketing() {
  await getQueue(QUEUES.MARKETING).upsertJobScheduler(
    "marketing-dispatch-due",
    { every: 60 * 1000 },
    { name: MARKETING_JOBS.DISPATCH_DUE },
  );
}

module.exports = { processMarketing, scheduleMarketing };
