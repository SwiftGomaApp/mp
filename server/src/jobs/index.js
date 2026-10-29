const { QUEUES } = require("../core/queue/queues");
const { processNotification } = require("./notifications.job");
const { processMaintenance } = require("./maintenance.job");
const { processMarketing } = require("./marketing.job");

const processors = [
  { queue: QUEUES.NOTIFICATIONS, processor: processNotification },
  { queue: QUEUES.MAINTENANCE, processor: processMaintenance, concurrency: 1 },
  { queue: QUEUES.MARKETING, processor: processMarketing, concurrency: 1 },
];

module.exports = { processors };
