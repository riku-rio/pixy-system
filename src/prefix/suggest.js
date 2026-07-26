const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  PermissionsBitField,
} = require("discord.js");

module.exports = {
  name: "suggest",
  aliases: ["suggestion", "feedback"],
  userPermissions: [PermissionsBitField.Flags.Administrator],
  userPermissionsMessage: "Only administrators can use this command.",
  guildOnly: true,
  guildOnlyMessage: "This command can only be used in a server.",

  async execute(message, args) {
    const embed = new EmbedBuilder()
      .setTitle("📝 Suggestion Box")
      .setDescription(
        "Use the select menu below to submit a suggestion for the bot.\nYour feedback helps us improve!"
      )
      .setColor(0x5865f2)
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("suggest_select")
      .setPlaceholder("Choose an option...")
      .addOptions([
        {
          label: "Submit Suggestion",
          description: "Send a suggestion to the bot developers",
          value: "suggest",
          emoji: { name: "💡" },
        },
        {
          label: "Reset",
          description: "Reset the select menu",
          value: "reset",
          emoji: { name: "🔄" },
        },
      ]);

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await message.channel.send({ embeds: [embed], components: [row] });
  },

  selectMenuHandlers: [
    {
      customId: "suggest_select",
      async execute(interaction) {
        const selectedValue = interaction.values[0];

        if (selectedValue === "reset") {
          await interaction.reply({ content: "Select menu has been reset.", flags: 64 });
          return;
        }

        const modal = new ModalBuilder()
          .setCustomId("suggest_modal")
          .setTitle("Submit Your Suggestion");

        const suggestionInput = new TextInputBuilder()
          .setCustomId("suggestion_input")
          .setLabel("Your Suggestion")
          .setPlaceholder("Type your suggestion here...")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(true)
          .setMinLength(10)
          .setMaxLength(1000);

        const reasonInput = new TextInputBuilder()
          .setCustomId("reason_input")
          .setLabel("Why is this suggestion important?")
          .setPlaceholder("(Optional) Explain why this would be helpful")
          .setStyle(TextInputStyle.Paragraph)
          .setRequired(false)
          .setMaxLength(500);

        const firstActionRow = new ActionRowBuilder().addComponents(suggestionInput);
        const secondActionRow = new ActionRowBuilder().addComponents(reasonInput);

        modal.addComponents(firstActionRow, secondActionRow);

        await interaction.showModal(modal);
      },
    },
  ],

  modalHandlers: [
    {
      customId: "suggest_modal",
      async execute(interaction) {
        const suggestion = interaction.fields.getTextInputValue("suggestion_input");
        const reason = interaction.fields.getTextInputValue("reason_input") || "No reason provided";
        const timestamp = Math.floor(Date.now() / 1000);

        const confirmationEmbed = new EmbedBuilder()
          .setTitle("✅ Suggestion Submitted!")
          .setDescription("Thank you for your feedback! Your suggestion has been sent to the bot developers.")
          .setColor(0x57f287)
          .setTimestamp();

        await interaction.reply({ embeds: [confirmationEmbed], flags: 64 });

        const suggestionEmbed = new EmbedBuilder()
          .setTitle("📝 New Suggestion Received")
          .setColor(0xfee75c)
          .addFields(
            {
              name: "👤 User",
              value: `${interaction.user.tag} (${interaction.user.id})`,
              inline: true,
            },
            {
              name: "📍 Server",
              value: interaction.guild ? `${interaction.guild.name} (${interaction.guild.id})` : "DM",
              inline: true,
            },
            {
              name: "📝 Suggestion",
              value: suggestion,
              inline: false,
            },
            {
              name: "💡 Reason",
              value: reason,
              inline: false,
            },
            {
              name: "🕐 Timestamp",
              value: `<t:${timestamp}:F> (<t:${timestamp}:R>)`,
              inline: false,
            }
          )
          .setFooter({ text: `User ID: ${interaction.user.id}` })
          .setTimestamp();

        try {
          const owner = await interaction.client.users.fetch(interaction.client.appEnv?.ownerId || interaction.client.application?.owner?.id);
          if (owner) {
            await owner.send({ embeds: [suggestionEmbed] });
          }
        } catch {
          if (interaction.client.appEnv?.suggestionChannelId) {
            try {
              const channel = await interaction.client.channels.fetch(interaction.client.appEnv.suggestionChannelId);
              if (channel) {
                await channel.send({ embeds: [suggestionEmbed] });
              }
            } catch {}
          }
        }
      },
    },
  ],
};
