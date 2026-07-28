const { bootstrap } = require("./src/config/bootstrap");
const { startHealthServer } = require("./src/health-server");
const {
  prepareProductionDatabase,
} = require("./src/config/runtimeDatabasePreparation");

async function main() {
  startHealthServer();
  prepareProductionDatabase();
  await bootstrap();
}

main().catch((error) => {
  console.error("Application startup failed:", error);
  process.exit(1);
});
