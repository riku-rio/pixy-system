const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require("discord.js");
const { prisma } = require("../config/prisma");

const EMBED_COLOR = 0x5865f2;
const EMBED_TOTAL_CHARACTER_LIMIT = 6000;
const BODY_CHARACTER_LIMIT = 4000;
const TITLE_CHARACTER_LIMIT = 256;
const FOOTER_CHARACTER_LIMIT = 2048;

function isOwner(userId, client) {
  return Boolean(client.appEnv?.ownerId && userId === client.appEnv.ownerId);
}

function buildAnnouncementEmbed({ title, body, footer }) {
  const embed = new EmbedBuilder()
    .setColor(EMBED_COLOR)
    .setDescription(body)
    .setTimestamp();

  if (title) {
    embed.setTitle(title);
  }

  if (footer) {
    embed.setFooter({ text: footer });
  }

  return embed;
}

function validateEmbedLength({ title, footer, englishText, arabicText }) {
  const fixedLength = title.length + footer.length;
  const availableBodyLength = EMBED_TOTAL_CHARACTER_LIMIT - fixedLength;
  const longestBodyLength = Math.max(englishText.length, arabicText.length);

  if (longestBodyLength <= availableBodyLength) {
    return null;
  }

  return (
    `The title and footer leave room for only ${Math.max(0, availableBodyLength)} body characters. ` +
    "Shorten the title, footer, or language text and submit again."
  );
}

function buildComposerModal(ownerId, channelId) {
  return new ModalBuilder()
    .setCustomId(`enar_modal:${ownerId}:${channelId}`)
    .setTitle("English / Arabic Announcement")
    .addComponents(
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("enar_title")
          .setLabel("Embed title")
          .setPlaceholder("Optional announcement title")
          .setStyle(TextInputStyle.Short)
          .setMaxLength(TITLE_CHARACTER_LIMIT)
          .setRequired(false)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("enar_english")
          .setLabel("English message")
          .setPlaceholder("Write the English version")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(BODY_CHARACTER_LIMIT)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("enar_arabic")
          .setLabel("Arabic message")
          .setPlaceholder("اكتب النسخة العربية")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(BODY_CHARACTER_LIMIT)
          .setRequired(true)
      ),
      new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId("enar_footer")
          .setLabel("Embed footer")
          .setPlaceholder("Optional footer")
          .setStyle(TextInputStyle.Paragraph)
          .setMaxLength(FOOTER_CHARACTER_LIMIT)
          .setRequired(false)
      )
    );
}

module.exports = {
  name: "enar",
  aliases: ["enar-message", "bilingual-message"],
  guildOnly: true,
  guildOnlyMessage: "This command can only be used inside a server.",

  async execute(message) {
    await message.delete().catch(() => null);

    if (!isOwner(message.author.id, message.client)) {
      const warning = await message.channel
        .send("Only the bot owner can use this command.")
        .catch(() => null);

      if (warning) {
        const timer = setTimeout(() => warning.delete().catch(() => null), 5000);
        if (typeof timer.unref === "function") timer.unref();
      }
      return;
    }

    const embed = new EmbedBuilder()
      .setTitle("🌐 Bilingual Announcement Composer")
      .setDescription("Choose the channel where the English announcement should be published.")
      .setColor(EMBED_COLOR)
      .setFooter({ text: "The Arabic version will be available from a private button." });

    const channelMenu = new ChannelSelectMenuBuilder()
      .setCustomId(`enar_channel:${message.author.id}`)
      .setPlaceholder("Choose an announcement channel")
      .setChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
      .setMinValues(1)
      .setMaxValues(1);

    await message.channel.send({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(channelMenu)],
      allowedMentions: { parse: [] },
    });
  },

  selectMenuHandlers: [
    {
      type: "channel",
      customIdPrefix: "enar_channel:",
      async execute(interaction) {
        const ownerId = interaction.customId.split(":")[1];

        if (!isOwner(interaction.user.id, interaction.client) || interaction.user.id !== ownerId) {
          return interaction.reply({
            content: "Only the bot owner who opened this composer can continue.",
            flags: 64,
          });
        }

        const channelId = interaction.values[0];
        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

        if (!channel?.isTextBased() || channel.isDMBased?.()) {
          return interaction.reply({
            content: "Choose a server text or announcement channel.",
            flags: 64,
          });
        }

        await interaction.showModal(buildComposerModal(ownerId, channelId));
      },
    },
  ],

  modalHandlers: [
    {
      customIdPrefix: "enar_modal:",
      async execute(interaction) {
        const [, ownerId, channelId] = interaction.customId.split(":");

        if (!isOwner(interaction.user.id, interaction.client) || interaction.user.id !== ownerId) {
          return interaction.reply({
            content: "Only the bot owner who opened this composer can publish the announcement.",
            flags: 64,
          });
        }

        const title = interaction.fields.getTextInputValue("enar_title").trim();
        const englishText = interaction.fields.getTextInputValue("enar_english").trim();
        const arabicText = interaction.fields.getTextInputValue("enar_arabic").trim();
        const footer = interaction.fields.getTextInputValue("enar_footer").trim();

        if (!englishText || !arabicText) {
          return interaction.reply({
            content: "Both the English and Arabic messages are required.",
            flags: 64,
          });
        }

        const lengthError = validateEmbedLength({
          title,
          footer,
          englishText,
          arabicText,
        });

        if (lengthError) {
          return interaction.reply({ content: lengthError, flags: 64 });
        }

        const channel = await interaction.guild.channels.fetch(channelId).catch(() => null);

        if (!channel?.isTextBased() || channel.isDMBased?.()) {
          return interaction.reply({
            content: "The selected destination channel is no longer available.",
            flags: 64,
          });
        }

        await interaction.deferReply({ flags: 64 });

        const announcement = await prisma.bilingualAnnouncement.create({
          data: {
            guildId: interaction.guildId,
            channelId,
            createdBy: interaction.user.id,
            title: title || null,
            footer: footer || null,
            englishText,
            arabicText,
          },
        });

        const arabicButton = new ButtonBuilder()
          .setCustomId(`enar_ar:${announcement.id}`)
          .setLabel("العربية")
          .setEmoji("🌐")
          .setStyle(ButtonStyle.Secondary);

        try {
          const sentMessage = await channel.send({
            embeds: [
              buildAnnouncementEmbed({
                title,
                body: englishText,
                footer,
              }),
            ],
            components: [new ActionRowBuilder().addComponents(arabicButton)],
            allowedMentions: { parse: [] },
          });

          await prisma.bilingualAnnouncement.update({
            where: { id: announcement.id },
            data: { messageId: sentMessage.id },
          });

          await interaction.editReply(`Announcement published in <#${channelId}>.`);
        } catch (error) {
          await prisma.bilingualAnnouncement.delete({
            where: { id: announcement.id },
          }).catch(() => null);

          console.error("Bilingual announcement publish failed:", error);
          await interaction.editReply(
            "The announcement could not be published. Check the bot permissions in the selected channel."
          );
        }
      },
    },
  ],

  buttonHandlers: [
    {
      customIdPrefix: "enar_ar:",
      async execute(interaction) {
        const announcementId = interaction.customId.slice("enar_ar:".length);
        const announcement = await prisma.bilingualAnnouncement.findUnique({
          where: { id: announcementId },
        });

        if (!announcement || announcement.guildId !== interaction.guildId) {
          return interaction.reply({
            content: "The Arabic version is no longer available.",
            flags: 64,
          });
        }

        await interaction.reply({
          embeds: [
            buildAnnouncementEmbed({
              title: announcement.title || "",
              body: announcement.arabicText,
              footer: announcement.footer || "",
            }),
          ],
          flags: 64,
          allowedMentions: { parse: [] },
        });
      },
    },
  ],
};
