-- CreateEnum
CREATE TYPE "VerificationType" AS ENUM ('SELLER', 'RIDER');

-- CreateEnum
CREATE TYPE "VerificationOpinion" AS ENUM ('RECOMMEND_APPROVE', 'RECOMMEND_REJECT');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('MOTO', 'CAR');

-- CreateEnum
CREATE TYPE "CallOutcome" AS ENUM ('REACHED', 'NO_ANSWER', 'WRONG_NUMBER', 'REFUSED');

-- CreateEnum
CREATE TYPE "VerificationDocumentType" AS ENUM ('ID_CARD', 'SELFIE', 'PROOF_OF_ADDRESS', 'RCCM', 'SHOP_PHOTO', 'DRIVING_LICENCE', 'VEHICLE_PHOTO', 'VEHICLE_DOCUMENT', 'VEHICLE_INSURANCE');

-- CreateTable
CREATE TABLE "verification_cases" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "VerificationType" NOT NULL,
    "status" "VerificationStatus" NOT NULL DEFAULT 'PENDING',
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "taxNumber" TEXT,
    "vehicleType" "VehicleType",
    "plateNumber" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "opinion" "VerificationOpinion",
    "opinionNote" TEXT,
    "decidedById" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_documents" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "type" "VerificationDocumentType" NOT NULL,
    "storageId" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification_calls" (
    "id" TEXT NOT NULL,
    "caseId" TEXT NOT NULL,
    "callerId" TEXT,
    "phone" TEXT NOT NULL,
    "outcome" "CallOutcome" NOT NULL,
    "notes" TEXT,
    "calledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verification_calls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "verification_cases_status_submittedAt_idx" ON "verification_cases"("status", "submittedAt");

-- CreateIndex
CREATE INDEX "verification_cases_userId_createdAt_idx" ON "verification_cases"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "verification_cases_plateNumber_idx" ON "verification_cases"("plateNumber");

-- CreateIndex
CREATE INDEX "verification_documents_expiresAt_idx" ON "verification_documents"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "verification_documents_caseId_type_key" ON "verification_documents"("caseId", "type");

-- CreateIndex
CREATE INDEX "verification_calls_caseId_calledAt_idx" ON "verification_calls"("caseId", "calledAt");

-- AddForeignKey
ALTER TABLE "verification_cases" ADD CONSTRAINT "verification_cases_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_cases" ADD CONSTRAINT "verification_cases_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_cases" ADD CONSTRAINT "verification_cases_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "verification_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_calls" ADD CONSTRAINT "verification_calls_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "verification_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verification_calls" ADD CONSTRAINT "verification_calls_callerId_fkey" FOREIGN KEY ("callerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- One open verification case per user (PENDING or IN_REVIEW)
CREATE UNIQUE INDEX "verification_cases_one_open_per_user"
  ON "verification_cases" ("userId")
  WHERE "status" IN ('PENDING', 'IN_REVIEW');