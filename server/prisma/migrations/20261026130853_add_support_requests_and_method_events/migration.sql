-- CreateEnum
CREATE TYPE "SupportRequestStatus" AS ENUM ('OPEN', 'CLOSED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEvent" ADD VALUE 'STAFF_SETUP_RESENT';
ALTER TYPE "ActivityEvent" ADD VALUE 'LOGIN_METHOD_REMOVED';
ALTER TYPE "ActivityEvent" ADD VALUE 'SUPPORT_REQUEST_CREATED';

-- CreateTable
CREATE TABLE "support_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "SupportRequestStatus" NOT NULL DEFAULT 'OPEN',
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "support_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "support_requests_userId_status_idx" ON "support_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "support_requests_status_createdAt_idx" ON "support_requests"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "support_requests" ADD CONSTRAINT "support_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
