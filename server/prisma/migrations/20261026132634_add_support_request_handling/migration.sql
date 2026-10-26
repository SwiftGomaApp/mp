-- AlterEnum
ALTER TYPE "ActivityEvent" ADD VALUE 'SUPPORT_REQUEST_CLOSED';

-- AlterTable
ALTER TABLE "support_requests" ADD COLUMN     "closedAt" TIMESTAMP(3),
ADD COLUMN     "closedBy" TEXT,
ADD COLUMN     "note" TEXT;
