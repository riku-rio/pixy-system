const dotenv = require("dotenv");

const SNOWFLAKE_PATTERN = /^\d{17,20}$/;

function readEnvironmentValue(name, { required = true, defaultValue = null } = {}) {
  const value = String(process.env[name] ?? defaultValue ?? "").trim();

  if (required && !value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value || null;
}

function readSnowflake(name, options) {
  const value = readEnvironmentValue(name, options);

  if (value && !SNOWFLAKE_PATTERN.test(value)) {
    throw new Error(`${name} must be a valid Discord ID.`);
  }

  return value;
}

function loadEnv() {
  dotenv.config({ quiet: true });

  const nodeEnv = readEnvironmentValue("NODE_ENV", {
    required: false,
    defaultValue: "development",
  }).toLowerCase();
  const instanceName = readEnvironmentValue("BOT_INSTANCE_NAME", {
    required: false,
    defaultValue: "pixy-system",
  });
  const prefix = readEnvironmentValue("PREFIX", {
    required: false,
    defaultValue: "^",
  });

  const token = readEnvironmentValue("DISCORD_TOKEN");
  const clientId = readSnowflake("DISCORD_CLIENT_ID");
  const guildId = readSnowflake("DISCORD_GUILD_ID");
  const ownerId = readSnowflake("OWNER_ID");
  const adminRoleId = readSnowflake("ADMIN_ROLE_ID");
  const ticketCategoryId = readSnowflake("TICKET_CATEGORY_ID");
  const ticketLogChannelId = readSnowflake("TICKET_LOG_CHANNEL_ID");
  const ticketNotificationsChannelId = readSnowflake("TICKET_NOTIFICATIONS_CHANNEL_ID");
  const bugFallbackChannelId = readSnowflake("BUG_FALLBACK_CHANNEL_ID");
  const suggestionChannelId = readSnowflake("SUGGESTION_CHANNEL_ID");

  readEnvironmentValue("DATABASE_URL");

  return {
    token,
    clientId,
    guildId,
    prefix,
    ownerId,
    adminRoleId,
    ticketCategoryId,
    ticketLogChannelId,
    ticketNotificationsChannelId,
    bugFallbackChannelId,
    suggestionChannelId,
    instanceName,
    nodeEnv,
    isProduction: nodeEnv === "production",
  };
}

module.exports = {
  loadEnv,
};
