-- CreateEnum
CREATE TYPE "ThemePreference" AS ENUM ('LIGHT', 'DARK', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReviewNameDisplay" AS ENUM ('FULL_NAME', 'FIRST_NAME_INITIAL', 'ANONYMOUS');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEvent" ADD VALUE 'PROFILE_UPDATED';
ALTER TYPE "ActivityEvent" ADD VALUE 'AVATAR_CHANGED';
ALTER TYPE "ActivityEvent" ADD VALUE 'ADDRESS_ADDED';
ALTER TYPE "ActivityEvent" ADD VALUE 'ADDRESS_UPDATED';
ALTER TYPE "ActivityEvent" ADD VALUE 'ADDRESS_REMOVED';
ALTER TYPE "ActivityEvent" ADD VALUE 'PREFERENCES_UPDATED';
ALTER TYPE "ActivityEvent" ADD VALUE 'ACCOUNT_DELETION_REQUESTED';
ALTER TYPE "ActivityEvent" ADD VALUE 'ACCOUNT_DELETION_CANCELLED';
ALTER TYPE "ActivityEvent" ADD VALUE 'ACCOUNT_DELETED';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "deletionRequestedAt" TIMESTAMP(3),
ADD COLUMN     "deletionScheduledAt" TIMESTAMP(3),
ADD COLUMN     "statusBeforeDeletion" "UserStatus";

-- CreateTable
CREATE TABLE "addresses" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "recipientName" TEXT,
    "recipientPhone" TEXT,
    "line1" TEXT NOT NULL,
    "quartier" TEXT,
    "comune" TEXT,
    "city" TEXT NOT NULL DEFAULT 'Goma',
    "landmark" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addresses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "userId" TEXT NOT NULL,
    "theme" "ThemePreference" NOT NULL DEFAULT 'SYSTEM',
    "dataSaver" BOOLEAN NOT NULL DEFAULT false,
    "preferredMomoNumber" TEXT,
    "reviewNameDisplay" "ReviewNameDisplay" NOT NULL DEFAULT 'FIRST_NAME_INITIAL',
    "newOrderSound" TEXT NOT NULL DEFAULT 'default',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("userId")
);

-- CreateIndex
CREATE INDEX "addresses_userId_isDefault_idx" ON "addresses"("userId", "isDefault");

-- CreateIndex
CREATE INDEX "users_status_deletionScheduledAt_idx" ON "users"("status", "deletionScheduledAt");

-- AddForeignKey
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
