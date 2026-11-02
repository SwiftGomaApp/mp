-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEvent" ADD VALUE 'VERIFICATION_SUBMITTED';
ALTER TYPE "ActivityEvent" ADD VALUE 'VERIFICATION_TAKEN';
ALTER TYPE "ActivityEvent" ADD VALUE 'VERIFICATION_CALL_LOGGED';
ALTER TYPE "ActivityEvent" ADD VALUE 'VERIFICATION_OPINION_GIVEN';
ALTER TYPE "ActivityEvent" ADD VALUE 'VERIFICATION_APPROVED';
ALTER TYPE "ActivityEvent" ADD VALUE 'VERIFICATION_REJECTED';
ALTER TYPE "ActivityEvent" ADD VALUE 'VERIFICATION_DOCUMENT_VIEWED';

-- AlterTable
ALTER TABLE "verification_cases" ALTER COLUMN "status" SET DEFAULT 'NOT_SUBMITTED';
