const { getPrisma } = require("../../../core/db/prisma");

// What the person gave and was told, as in their own dossier view. Support's opinion, call
// notes and staff names stay out, like everywhere the applicant can see their dossier.
async function exportVerification(userId) {
  const cases = await getPrisma().verificationCase.findMany({
    where: { userId, status: { not: "NOT_SUBMITTED" } },
    orderBy: { createdAt: "asc" },
    select: {
      type: true,
      status: true,
      attempt: true,
      taxNumber: true,
      vehicleType: true,
      plateNumber: true,
      submittedAt: true,
      decidedAt: true,
      decisionNote: true,
      documents: {
        select: { type: true, mimeType: true, sizeBytes: true, expiresAt: true, createdAt: true },
      },
    },
  });

  return cases;
}

module.exports = { exportVerification };
