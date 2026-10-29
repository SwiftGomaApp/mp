const { Queue } = require("bullmq");
const { createRedisConnection } = require("../cache/redis");
const { getConfig } = require("../../config/env.config");

const QUEUES = {
  NOTIFICATIONS: "notifications",
  MAINTENANCE: "maintenance",
  MARKETING: "marketing",
};

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { type: "exponential", delay: 5000 },
  removeOnComplete: { age: 3600, count: 1000 },
  removeOnFail: { age: 7 * 86400 },
};

const QUEUE_JOB_OPTIONS = {
  [QUEUES.NOTIFICATIONS]: {
    removeOnComplete: true,
    removeOnFail: { age: 3600 },
  },
  [QUEUES.MAINTENANCE]: {
    removeOnComplete: true,
    removeOnFail: { age: 86400 },
  },
  [QUEUES.MARKETING]: {
    removeOnComplete: true,
    removeOnFail: { age: 7 * 86400 },
  },
};

const entries = new Map();

function queuePrefix() {
  return `${getConfig().redis.keyPrefix}bull`;
}

function getQueue(name) {
  if (entries.has(name)) return entries.get(name).queue;

  const connection = createRedisConnection();
  const queue = new Queue(name, {
    connection,
    prefix: queuePrefix(),
    defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, ...QUEUE_JOB_OPTIONS[name] },
  });

  entries.set(name, { queue, connection });
  return queue;
}

async function closeQueues() {
  const all = [...entries.values()];
  entries.clear();
  await Promise.all(
    all.map(async ({ queue, connection }) => {
      await queue.close();
      await connection.quit().catch(() => {});
    }),
  );
}

module.exports = { QUEUES, getQueue, closeQueues, queuePrefix };
