const { loadConfig } = require("../src/config/env.config");
const { getPrisma, disconnectPrisma } = require("../src/core/db/prisma");
const { disconnectRedis } = require("../src/core/cache/redis");
const { revokeUserSessions } = require("../src/features/auth/services/session.service");
const { logActivity } = require("../src/features/auth/services/activity.service");

function fail(message) {
  console.error(`X ${message}`);
  process.exitCode = 1;
}

async function main() {
  const [rawEmail] = process.argv.slice(2);
  if (!rawEmail) return fail("Usage: node scripts/reset-admin-2fa.js <admin-email>");
  const email = rawEmail.trim().toLowerCase();

  await loadConfig();
  const prisma = getPrisma();

  const admin = await prisma.user.findFirst({ where: { role: "ADMIN" } });
  if (!admin) return fail("No Admin account exists.");
  if (admin.email !== email) return fail("The email does not match the Admin account.");

  await prisma.$transaction([
    prisma.totpCredential.deleteMany({ where: { userId: admin.id } }),
    prisma.backupCode.deleteMany({ where: { userId: admin.id } }),
  ]);
  await revokeUserSessions(admin.id, { reason: "TWO_FACTOR_RESET" });

  await logActivity({
    userId: admin.id,
    event: "TOTP_DISABLED",
    metadata: { via: "reset-admin-2fa-script" },
  });

  console.log(`OK 2FA reset for ${admin.email}. All sessions were closed.`);
  console.log("Next steps:");
  console.log("  1. Log in now with the email code or your password.");
  console.log("  2. Set up 2FA again and save the new backup codes offline.");
}

main()
  .catch((err) => {
    console.error("X Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
    await disconnectRedis().catch(() => {});
  });
