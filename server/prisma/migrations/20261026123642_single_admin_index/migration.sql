-- This is an empty migration.
CREATE UNIQUE INDEX "users_single_admin" ON "users" ("role") WHERE "role" = 'ADMIN';