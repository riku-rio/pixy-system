const { Events } = require("discord.js");

module.exports = {
  name: Events.GuildCreate,

  async execute(guild) {
    const allowedGuildId = guild.client.appEnv?.guildId;

    if (guild.id === allowedGuildId) return;

    await guild.leave().catch(() => null);
  },
};
