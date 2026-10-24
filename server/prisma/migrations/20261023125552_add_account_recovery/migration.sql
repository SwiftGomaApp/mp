-- CreateEnum
CREATE TYPE "RecoveryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "account_recovery_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RecoveryStatus" NOT NULL DEFAULT 'PENDING',
    "reason" TEXT,
    "verificationHash" TEXT,
    "verificationExpiresAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewReason" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "availableAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "completedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_recovery_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_recovery_requests_verificationHash_key" ON "account_recovery_requests"("verificationHash");

-- CreateIndex
CREATE INDEX "account_recovery_requests_userId_status_idx" ON "account_recovery_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "account_recovery_requests_status_requestedAt_idx" ON "account_recovery_requests"("status", "requestedAt");

-- CreateIndex
CREATE INDEX "account_recovery_requests_expiresAt_idx" ON "account_recovery_requests"("expiresAt");

-- AddForeignKey
ALTER TABLE "account_recovery_requests" ADD CONSTRAINT "account_recovery_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
