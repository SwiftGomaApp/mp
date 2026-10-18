const { QUEUES } = require("../core/queue/queues");
const { processNotification } = require("./notifications.job");

const processors = [{ queue: QUEUES.NOTIFICATIONS, processor: processNotification }];

module.exports = { processors };
