-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActivityEvent" ADD VALUE 'ACCOUNT_UNLOCKED';
ALTER TYPE "ActivityEvent" ADD VALUE 'PASSWORD_RESET_BY_ADMIN';
ALTER TYPE "ActivityEvent" ADD VALUE 'TWO_FACTOR_RESET_BY_ADMIN';
ALTER TYPE "ActivityEvent" ADD VALUE 'PROFILE_MODERATED';
ALTER TYPE "ActivityEvent" ADD VALUE 'CONTACT_UPDATED_BY_ADMIN';
ALTER TYPE "ActivityEvent" ADD VALUE 'ACCOUNT_DELETION_FORCED';
ALTER TYPE "ActivityEvent" ADD VALUE 'DATA_EXPORTED_BY_ADMIN';
