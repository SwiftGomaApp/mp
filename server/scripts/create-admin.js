const { loadConfig } = require("../src/config/env.config");
const { getPrisma, disconnectPrisma } = require("../src/core/db/prisma");
const { email: emailSchema } = require("../src/core/validation/common");

function fail(message) {
  console.error(`X ${message}`);
  process.exit();
}

async function main() {
  const [rawEmail, ...nameParts] = process.argv.slice(2);
  const name = nameParts.join(" ").trim();

  if (!rawEmail || !name) {
    return fail('Usage: node scripts/create-admin.js <email> "<Full Name>"');
  }

  const parsed = emailSchema.safeParse(rawEmail);
  if (!parsed.success) return fail("Invalid email address");
  const email = parsed.data;

  await loadConfig();
  const prisma = getPrisma();

  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  if (existingAdmin) return fail("An admin already exists Only one is allowed");

  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email }, { phone: email }, { secondaryEmail: email }],
    },
    select: { id: true },
  });

  if (existingUser) return fail("This email is already userd by another account");

  let admin;
  try {
    admin = await prisma.user.create({
      data: {
        name,
        email,
        emailVerifiedAt: new Date(),
        role: "ADMIN",
        status: "ACTIVE",
      },
      select: { id: true, email: true },
    });
  } catch (err) {
    if (err.code === "P2002") return fail("An admin or this email already exists.");
    throw err;
  }

  await prisma.activityLog.create({
    data: {
      userId: admin.id,
      event: "SIGNUP_COMPLETED",
      method: "EMAIL_OTP",
      metadata: {
        createdBy: "create-admin-script",
        role: "Admin",
      },
    },
  });

  console.log(`✓ Admin created: ${admin.email} (${admin.id})`);
  console.log("Next steps:");
  console.log("  1. Log in now with the email code.");
  console.log("  2. Set up 2FA and save the backup codes offline.");
  console.log("  3. Then set your password.");
}

main()
  .catch((err) => {
    console.error("✗ Failed:", err.message);
    process.exitCode = 1;
  })
  .finally(() => disconnectPrisma());
