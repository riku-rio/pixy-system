require("dotenv").config();

const { prisma } = require("../src/config/prisma");

const CONFIRM_FLAG = "--confirm";

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

async function getApplicationTables() {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME <> '_prisma_migrations'
    ORDER BY TABLE_NAME
  `);

  return rows
    .map((row) => row.tableName || row.TABLE_NAME)
    .filter(Boolean);
}

async function clearDatabase() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(
      `Database clear cancelled. Re-run with ${CONFIRM_FLAG}: npm run db:clear -- ${CONFIRM_FLAG}`
    );
  }

  const tables = await getApplicationTables();

  if (tables.length === 0) {
    console.log("No application tables were found. Nothing was cleared.");
    return;
  }

  await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 0");

  try {
    for (const table of tables) {
      await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${quoteIdentifier(table)}`);
    }
  } finally {
    await prisma.$executeRawUnsafe("SET FOREIGN_KEY_CHECKS = 1");
  }

  console.log(`Database cleared successfully. Truncated ${tables.length} application table(s).`);
}

clearDatabase()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
