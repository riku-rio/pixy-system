const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

function isAdmin(interaction) {
  const adminRoleId = interaction.client.appEnv.adminRoleId;
  return (
    interaction.member?.roles?.cache?.has(adminRoleId) === true ||
    interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator) === true
  );
}

async function sendBugReport(interaction, embed) {
  const ownerId = interaction.client.appEnv.ownerId;
  const fallbackChannelId = interaction.client.appEnv.bugFallbackChannelId;

  try {
    const owner = await interaction.client.users.fetch(ownerId);
    await owner.send({ embeds: [embed] });
    return "dm";
  } catch {}

  try {
    const fallbackChannel = await interaction.client.channels.fetch(fallbackChannelId);
    if (!fallbackChannel?.isTextBased()) {
      throw new Error("Configured fallback channel is not text-based.");
    }

    await fallbackChannel.send({ embeds: [embed], allowedMentions: { parse: [] } });
    return "channel";
  } catch {
    throw new Error("The bug report could not be delivered to the owner or fallback channel.");
  }
}

module.exports = {
  name: "bug",
  aliases: ["bugs", "bugreport"],
  guildOnly: true,
  guildOnlyMessage: "This command can only be used inside a server.",

  async execute(message) {
    await message.delete().catch(() => null);

    const embed = new EmbedBuilder()
      .setTitle("🐛 Report a Bug")
      .setDescription(
        "Use the select menu below to report a bot or server issue.\n" +
        "Only members with the configured Admin role or Discord Administrator permission can submit reports."
      )
      .setColor(0xed4245)
      .setFooter({ text: "Please include clear reproduction steps." })
      .setTimestamp();

    const menu = new StringSelectMenuBuilder()
      .setCustomId("bug_select")
      .setPlaceholder("Choose an option...")
      .addOptions([
        {
          label: "Submit Bug Report",
          description: "Open the bug report form",
          value: "report",
          emoji: { name: "🐛" },
        },
        {
          label: "Reset",
          description: "Reset the select menu",
          value: "reset",
          emoji: { name: "🔄" },
        },
      ]);

    await message.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(menu)],
      allowedMentions: { parse: [] },
    });
  },

  selectMenuHandlers: [
    {
      customId: "bug_select",
      async execute(interaction) {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content: "Only the configured Admin role or a server administrator can submit bug reports.",
            flags: 64,
          });
        }

        if (interaction.values[0] === "reset") {
          return interaction.reply({ content: "Select menu has been reset.", flags: 64 });
        }

        const modal = new ModalBuilder()
          .setCustomId("bug_modal")
          .setTitle("Submit Bug Report")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("bug_title")
                .setLabel("Short title")
                .setPlaceholder("Example: Ticket lock button fails")
                .setStyle(TextInputStyle.Short)
                .setMinLength(5)
                .setMaxLength(100)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("bug_description")
                .setLabel("What happened?")
                .setPlaceholder("Describe the issue and what you observed")
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(10)
                .setMaxLength(1000)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("bug_steps")
                .setLabel("Steps to reproduce")
                .setPlaceholder("1. ...\n2. ...\n3. ...")
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(5)
                .setMaxLength(1000)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("bug_expected")
                .setLabel("Expected result")
                .setPlaceholder("What should have happened?")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(500)
                .setRequired(true)
            ),
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("bug_context")
                .setLabel("Extra context")
                .setPlaceholder("Optional IDs, error messages, or other details")
                .setStyle(TextInputStyle.Paragraph)
                .setMaxLength(500)
                .setRequired(false)
            )
          );

        await interaction.showModal(modal);
      },
    },
  ],

  modalHandlers: [
    {
      customId: "bug_modal",
      async execute(interaction) {
        if (!isAdmin(interaction)) {
          return interaction.reply({
            content: "Only the configured Admin role or a server administrator can submit bug reports.",
            flags: 64,
          });
        }

        const title = interaction.fields.getTextInputValue("bug_title").trim();
        const description = interaction.fields.getTextInputValue("bug_description").trim();
        const steps = interaction.fields.getTextInputValue("bug_steps").trim();
        const expected = interaction.fields.getTextInputValue("bug_expected").trim();
        const context = interaction.fields.getTextInputValue("bug_context").trim() || "No extra context provided.";
        const timestamp = Math.floor(Date.now() / 1000);

        await interaction.deferReply({ flags: 64 });

        const reportEmbed = new EmbedBuilder()
          .setTitle(`🐛 ${title}`)
          .setColor(0xed4245)
          .addFields(
            { name: "Reporter", value: `${interaction.user.tag} (${interaction.user.id})`, inline: true },
            { name: "Server", value: `${interaction.guild.name} (${interaction.guild.id})`, inline: true },
            { name: "Channel", value: `<#${interaction.channelId}> (${interaction.channelId})`, inline: false },
            { name: "What happened?", value: description, inline: false },
            { name: "Steps to reproduce", value: steps, inline: false },
            { name: "Expected result", value: expected, inline: false },
            { name: "Extra context", value: context, inline: false },
            { name: "Submitted", value: `<t:${timestamp}:F> (<t:${timestamp}:R>)`, inline: false }
          )
          .setFooter({ text: `Reporter ID: ${interaction.user.id}` })
          .setTimestamp();

        try {
          const destination = await sendBugReport(interaction, reportEmbed);
          await interaction.editReply(
            destination === "dm"
              ? "Bug report submitted and sent to the bot owner."
              : "Bug report submitted to the fallback bug channel because the owner DM was unavailable."
          );
        } catch (error) {
          await interaction.editReply(error.message || "The bug report could not be delivered.");
        }
      },
    },
  ],
};
