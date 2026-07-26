const { PrismaClient } = require("@prisma/client");
const { PrismaMariaDb } = require("@prisma/adapter-mariadb");

function resolveDatabaseUrl(databaseUrl) {
  return String(databaseUrl || process.env.DATABASE_URL || "").trim();
}

function createAdapter(databaseUrl) {
  const rawUrl = resolveDatabaseUrl(databaseUrl);
  if (!rawUrl) {
    throw new Error("DATABASE_URL is required.");
  }

  const url = new URL(rawUrl);
  if (url.protocol !== "mysql:" && url.protocol !== "mariadb:") {
    throw new Error("DATABASE_URL must use the mysql:// or mariadb:// protocol.");
  }

  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) {
    throw new Error("DATABASE_URL must include a database name.");
  }

  const isLocal = ["127.0.0.1", "localhost", "mysql"].includes(url.hostname);

  return new PrismaMariaDb({
    host: url.hostname,
    port: url.port ? Number(url.port) : 3306,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
    connectionLimit: Number(url.searchParams.get("connection_limit") || 10),
    connectTimeout: Number(url.searchParams.get("connect_timeout") || 5) * 1000,
    idleTimeout: Number(url.searchParams.get("max_idle_connection_lifetime") || 300),
    allowPublicKeyRetrieval: isLocal,
  });
}

const prisma = new PrismaClient({ adapter: createAdapter() });

module.exports = {
  createAdapter,
  prisma,
  resolveDatabaseUrl,
};
