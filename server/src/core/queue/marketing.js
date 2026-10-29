const { QUEUES, getQueue } = require("./queues");

const MARKETING_JOBS = {
  START: "campaign.start",
  BATCH: "campaign.batch",
  DISPATCH_DUE: "marketing.dispatch-due",
};

const queue = () => getQueue(QUEUES.MARKETING);

function queueCampaignStart(campaignId) {
  return queue().add(MARKETING_JOBS.START, { campaignId }, { jobId: `start-${campaignId}` });
}

function queueCampaignBatch(campaignId, delayMs = 0) {
  const data = { campaignId };
  return delayMs ? queue().add(MARKETING_JOBS.BATCH, data, { delay: delayMs }) : queue().add(MARKETING_JOBS.BATCH, data);
}

module.exports = { MARKETING_JOBS, queueCampaignStart, queueCampaignBatch };
