const { Worker } = require("bullmq");
const { createRedisConnection } = require("../cache/redis");
const { getConfig } = require("../../config/env.config");
const { logger } = require("../logger/logger");
const { queuePrefix } = require("./queues");

function startWorkers(processors) {
  const { workerConcurrency } = getConfig();

  const running = processors.map(({ queue, processor, concurrency }) => {
    const connection = createRedisConnection();
    const worker = new Worker(queue, processor, {
      connection,
      prefix: queuePrefix(),
      concurrency: concurrency || workerConcurrency,
    });

    worker.on("completed", (job) => {
      logger.debug({ queue, jobId: job.id, name: job.name }, "Job completed");
    });

    worker.on("failed", (job, err) => {
      logger.warn(
        { err, queue, jobId: job?.id, name: job?.name, attempt: job?.attemptsMade },
        "Job failed",
      );
    });

    worker.on("error", (err) => {
      logger.error({ err, queue }, "Worker error");
    });

    logger.info({ queue }, "Worker started");
    return { worker, connection };
  });

  return async function closeWorkers() {
    await Promise.all(
      running.map(async ({ worker, connection }) => {
        await worker.close();
        await connection.quit().catch(() => {});
      }),
    );
  };
}

module.exports = { startWorkers };
