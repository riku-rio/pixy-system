const { Events } = require("discord.js");

module.exports = {
  name: Events.ClientReady,

  async execute(client) {
    const allowedGuildId = client.appEnv?.guildId;
    const unauthorizedGuilds = client.guilds.cache.filter(
      (guild) => guild.id !== allowedGuildId,
    );

    await Promise.allSettled(
      unauthorizedGuilds.map((guild) => guild.leave()),
    );

    console.log(`Bot is ready as ${client.user.tag}`);
  },
};
