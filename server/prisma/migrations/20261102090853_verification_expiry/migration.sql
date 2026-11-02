-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEvent" ADD VALUE 'VERIFICATION_EXPIRY_REMINDED';
ALTER TYPE "ActivityEvent" ADD VALUE 'VERIFICATION_EXPIRED';

-- AlterEnum
ALTER TYPE "VerificationStatus" ADD VALUE 'EXPIRED';

-- AlterTable
ALTER TABLE "verification_documents" ADD COLUMN     "reminderSentAt" TIMESTAMP(3);
