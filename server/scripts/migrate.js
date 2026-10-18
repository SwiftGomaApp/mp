const { execFileSync } = require("child_process");
const { loadConfig } = require("../src/config/env.config");
const { logger } = require("../src/core/logger/logger");

async function main() {
  const config = await loadConfig();
  const prismaCli = require.resolve("prisma/build/index.js");

  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: config.databaseUrl },
  });

  logger.info("Migrations applied");
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.fatal({ err }, "Migration failed");
    process.exit(1);
  });
