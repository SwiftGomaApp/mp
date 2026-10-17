const express = require("express");

const { loadConfig } = require("./src/config/env.config");

async function main() {
  const config = await loadConfig();

  const app = express();
  app.use(express.json());

  app.get("/api/v1/health", (req, res) => res.json({ status: "ok" }));

  app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} (${config.env})`);
  });
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
