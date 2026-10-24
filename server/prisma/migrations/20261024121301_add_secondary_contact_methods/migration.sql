/*
  Warnings:

  - A unique constraint covering the columns `[secondaryEmail]` on the table `users` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[secondaryPhone]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "secondaryEmail" TEXT,
ADD COLUMN     "secondaryEmailVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "secondaryPhone" TEXT,
ADD COLUMN     "secondaryPhoneVerifiedAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_secondaryEmail_key" ON "users"("secondaryEmail");

-- CreateIndex
CREATE UNIQUE INDEX "users_secondaryPhone_key" ON "users"("secondaryPhone");
