const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = path.resolve(__dirname, "../..");

function ensurePrismaSchemaEngineExecutable() {
  if (process.platform === "win32") {
    return;
  }

  const engineDirectory = path.join(
    projectRoot,
    "node_modules",
    "@prisma",
    "engines"
  );

  if (!fs.existsSync(engineDirectory)) {
    throw new Error(
      `Prisma engines directory was not found: ${engineDirectory}`
    );
  }

  const schemaEngines = fs
    .readdirSync(engineDirectory)
    .filter((fileName) => fileName.startsWith("schema-engine-"));

  if (schemaEngines.length === 0) {
    throw new Error(
      `No Prisma schema engine was found in: ${engineDirectory}`
    );
  }

  for (const fileName of schemaEngines) {
    const enginePath = path.join(engineDirectory, fileName);

    fs.chmodSync(enginePath, 0o755);

    console.log(
      `Prisma schema engine marked executable: ${enginePath}`
    );
  }
}

function runNodeTask(taskName, scriptPath, args = []) {
  console.log(`Running production database task: ${taskName}`);

  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `Production database task "${taskName}" could not find: ${scriptPath}`
    );
  }

  const result = spawnSync(
    process.execPath,
    [scriptPath, ...args],
    {
      cwd: projectRoot,
      stdio: "inherit",
      env: process.env,
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Production database task "${taskName}" failed with exit code ${result.status}.`
    );
  }
}

function runPrismaMigration() {
  ensurePrismaSchemaEngineExecutable();

  const prismaCliPath = path.join(
    projectRoot,
    "node_modules",
    "prisma",
    "build",
    "index.js"
  );

  runNodeTask(
    "prisma:migrate",
    prismaCliPath,
    ["migrate", "deploy"]
  );
}

function prepareProductionDatabase() {
  const nodeEnv = String(
    process.env.NODE_ENV || ""
  ).toLowerCase();

  if (nodeEnv !== "production") {
    console.log(
      "Skipping production database preparation outside production."
    );
    return;
  }

  runPrismaMigration();
}

module.exports = {
  prepareProductionDatabase,
};
