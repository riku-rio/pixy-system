const dotenv = require("dotenv");

function loadEnv() {
  dotenv.config({ quiet: true });

  const token = process.env.DISCORD_TOKEN;
  const clientId = process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const prefix = process.env.PREFIX || "!";
  const nodeEnv = String(process.env.NODE_ENV || "development").toLowerCase();
  const isProduction = nodeEnv === "production";

  const missing = [];
  if (!token) {
    missing.push("DISCORD_TOKEN");
  }
  if (!clientId) {
    missing.push("DISCORD_CLIENT_ID");
  }

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }

  return {
    token,
    clientId,
    guildId,
    prefix,
    nodeEnv,
    isProduction
  };
}

module.exports = {
  loadEnv,
};
