const { getPrisma } = require("../../../core/db/prisma");
const { logger } = require("../../../core/logger/logger");
const { removeStoredDocument } = require("../utils/verification.storage");

// Erases everything a person sent to be verified: the stored files first, then the rows.
// A file that cannot be removed stops the purge, which is retried on the next run, so no
// identity document is left behind without a row pointing to it.
async function purgeVerification(userId) {
  const prisma = getPrisma();

  const documents = await prisma.verificationDocument.findMany({
    where: { case: { userId } },
    select: { storageId: true },
  });

  for (const { storageId } of documents) {
    await removeStoredDocument(storageId);
  }

  // Documents and calls go with their case.
  const { count } = await prisma.verificationCase.deleteMany({ where: { userId } });

  if (count) logger.info({ userId, cases: count, files: documents.length }, "Purged verification");
  return count;
}

module.exports = { purgeVerification };
