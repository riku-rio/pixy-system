require("dotenv").config({ quiet: true });

const mariadb = require("mariadb");

const CONFIRM_FLAG = "--confirm";

function quoteIdentifier(value) {
  return `\`${String(value).replace(/`/g, "``")}\``;
}

function getConnectionOptions() {
  const rawUrl = String(process.env.DATABASE_URL || "").trim();
  if (!rawUrl) throw new Error("DATABASE_URL is required.");

  const url = new URL(rawUrl);
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL must use the mysql:// or mariadb:// protocol.");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new Error("DATABASE_URL must include a database name.");

  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectTimeout: Number(url.searchParams.get("connect_timeout") || 5) * 1000,
  };
}

async function getApplicationTables(connection) {
  const rows = await connection.query(`
    SELECT TABLE_NAME AS tableName
    FROM information_schema.tables
    WHERE table_schema = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
      AND TABLE_NAME <> '_prisma_migrations'
    ORDER BY TABLE_NAME
  `);

  return rows.map((row) => row.tableName).filter(Boolean);
}

async function getAutoIncrementTables(connection) {
  const rows = await connection.query(`
    SELECT DISTINCT TABLE_NAME AS tableName
    FROM information_schema.columns
    WHERE table_schema = DATABASE()
      AND EXTRA LIKE '%auto_increment%'
      AND TABLE_NAME <> '_prisma_migrations'
    ORDER BY TABLE_NAME
  `);

  return rows.map((row) => row.tableName).filter(Boolean);
}

async function clearDatabase() {
  if (!process.argv.includes(CONFIRM_FLAG)) {
    throw new Error(
      `Database clear cancelled. Re-run with ${CONFIRM_FLAG}: npm run db:clear -- ${CONFIRM_FLAG}`
    );
  }

  const connection = await mariadb.createConnection(getConnectionOptions());

  try {
    const tables = await getApplicationTables(connection);

    if (tables.length === 0) {
      console.log("No application tables were found. Nothing was cleared.");
      return;
    }

    const autoIncrementTables = await getAutoIncrementTables(connection);

    await connection.query("SET FOREIGN_KEY_CHECKS = 0");

    try {
      await connection.beginTransaction();

      for (const table of tables) {
        await connection.query(`DELETE FROM ${quoteIdentifier(table)}`);
      }

      await connection.commit();

      for (const table of autoIncrementTables) {
        await connection.query(`ALTER TABLE ${quoteIdentifier(table)} AUTO_INCREMENT = 1`);
      }
    } catch (error) {
      await connection.rollback().catch(() => null);
      throw error;
    } finally {
      await connection.query("SET FOREIGN_KEY_CHECKS = 1");
    }

    console.log(`Database cleared successfully. Cleared ${tables.length} application table(s).`);
  } finally {
    await connection.end();
  }
}

clearDatabase().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
