// const { PrismaClient } = require("@prisma/client");
// const { PrismaPg } = require("@prisma/adapter-pg");
// const { getConfig } = require("../../config/env.config");

// /** @type {import("@prisma/client").PrismaClient | null} */
// let prisma = null;

// /** @returns {import("@prisma/client").PrismaClient} */
// function getPrisma() {
//   if (prisma) return prisma;

//   const config = getConfig();

//   const adapter = new PrismaPg({
//     connectionString: config.databaseUrl,
//     max: config.dbPoolMax,
//     idleTimeoutMillis: 30000,
//     connectionTimeoutMillis: 5000,
//   });

//   prisma = new PrismaClient({
//     adapter,
//     log: config.isProd ? ["error"] : ["warn", "error"],
//   });

//   return prisma;
// }

// async function connectPrisma() {
//   const client = getPrisma();
//   await client.$queryRaw`SELECT 1`;
//   return client;
// }

// async function disconnectPrisma() {
//   if (!prisma) return;
//   await prisma.$disconnect();
//   prisma = null;
// }

// module.exports = { getPrisma, connectPrisma, disconnectPrisma };

const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { getConfig } = require("../../config/env.config");

/** @type {import("@prisma/client").PrismaClient | null} */
let prisma = null;

/** @returns {import("@prisma/client").PrismaClient} */
function getPrisma() {
  if (prisma) return prisma;

  const config = getConfig();

  const adapter = new PrismaPg({
    connectionString: config.databaseUrl,
    max: config.dbPoolMax,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
  });

  prisma = new PrismaClient({
    adapter,
    log: config.isProd ? ["error"] : ["warn", "error"],
  });

  return prisma;
}

async function connectPrisma() {
  const client = getPrisma();
  try {
    await client.$queryRaw`SELECT 1`;
  } catch (err) {
    console.error("DB connect failed:", {
      code: err.code,
      meta: err.meta,
      cause: err.cause,
    });
    throw err;
  }
  return client;
}

async function disconnectPrisma() {
  if (!prisma) return;
  await prisma.$disconnect();
  prisma = null;
}

module.exports = { getPrisma, connectPrisma, disconnectPrisma };
