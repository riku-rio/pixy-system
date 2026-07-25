const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionsBitField,
  ChannelType,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  AttachmentBuilder,
  OverwriteType,
} = require("discord.js");
const { prisma } = require("../config/prisma");

const TICKET_CATEGORY_ID = "1528706907404242955";
const CLAIMER_ROLE_ID = "1528708288814776411";
const ESCALATION_ROLE_ID = "1528735714878164992";
const TICKET_LOG_CHANNEL = "1528712602157449286";
const NOTIFICATIONS_CHANNEL_ID = "1528732283513733221";

const TICKET_CATEGORIES = [
  { label: "General Support", description: "Get help with general questions", value: "general", emoji: "🛟" },
  { label: "Bug Report", description: "Report a bug or unexpected behaviour", value: "bug", emoji: "🐛" },
  { label: "Other", description: "Something that does not fit above", value: "other", emoji: "📋" },
  { label: "Reset", description: "Reset the select menu", value: "reset", emoji: "🔄" },
];
const PRIORITY_LABELS = {
  low: { label: "🟢 Low", color: 0x57f287 },
  medium: { label: "🟡 Medium", color: 0xfee75c },
  high: { label: "🔴 High", color: 0xed4245 },
  critical: { label: "🚨 Critical", color: 0xff4444 },
};

const isOwner = (message) => message.client.appEnv?.ownerId === message.author.id;
const isStaff = (interaction) => interaction.member?.roles?.cache?.has(CLAIMER_ROLE_ID) || interaction.memberPermissions?.has(PermissionsBitField.Flags.Administrator);

async function ensureGuild(guildId) {
  await prisma.guildConfig.upsert({
    where: { guildId },
    create: { guildId, ticketCategoryId: TICKET_CATEGORY_ID },
    update: { ticketCategoryId: TICKET_CATEGORY_ID },
  });
}

async function getTicket(channelId) {
  return prisma.ticketChannel.findUnique({ where: { channelId } });
}

async function findActiveTicket(guild, userId) {
  const tickets = await prisma.ticketChannel.findMany({
    where: { guildId: guild.id, userId, closed: false },
  });
  let activeTicket = null;

  for (const ticket of tickets) {
    let channel = guild.channels.cache.get(ticket.channelId);
    if (!channel) {
      try {
        channel = await guild.channels.fetch(ticket.channelId);
      } catch (error) {
        if (Number(error?.code) !== 10003) throw error;
      }
    }

    if (channel) {
      if (!activeTicket) activeTicket = ticket;
      continue;
    }

    await prisma.ticketChannel.update({
      where: { channelId: ticket.channelId },
      data: { closed: true, closedAt: new Date() },
    });
  }

  return activeTicket;
}

function buildControlPanel(ticket, guild) {
  const category = TICKET_CATEGORIES.find((item) => item.value === ticket.category) || { label: ticket.category, emoji: "🎫" };
  const priority = PRIORITY_LABELS[ticket.priority] || PRIORITY_LABELS.medium;
  const openedAt = Math.floor(new Date(ticket.openedAt).getTime() / 1000);
  return new EmbedBuilder()
    .setAuthor({ name: "Ticket Control Panel", iconURL: guild.iconURL({ dynamic: true }) })
    .setTitle(`${category.emoji} ${ticket.name}`)
    .setColor(priority.color)
    .setDescription("This ticket is private to its opener and staff. Use the controls below to manage it.")
    .addFields(
      { name: "Opened by", value: `<@${ticket.userId}>`, inline: true },
      { name: "Category", value: category.label, inline: true },
      { name: "Priority", value: priority.label, inline: true },
      { name: "Claimed by", value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "Unclaimed", inline: false },
      { name: "Opened", value: `<t:${openedAt}:F>`, inline: false }
    )
    .setFooter({ text: `Ticket ID: ${ticket.channelId}` });
}

function buildButtons(ticket) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_close:${ticket.channelId}`).setLabel("Close Ticket").setEmoji("🔒").setStyle(ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`ticket_claim:${ticket.channelId}`).setLabel(ticket.claimedBy ? "Unclaim" : "Claim Ticket").setEmoji("🙋").setStyle(ticket.claimedBy ? ButtonStyle.Secondary : ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ticket_escalate:${ticket.channelId}`).setLabel("Escalate").setEmoji("🚨").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ticket_priority:${ticket.channelId}`).setLabel("Set Priority").setEmoji("📊").setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_adduser:${ticket.channelId}`).setLabel("Add User").setEmoji("👥").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket_removeuser:${ticket.channelId}`).setLabel("Remove User").setEmoji("👋").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket_transcript:${ticket.channelId}`).setLabel("Save Transcript").setEmoji("📄").setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`ticket_lock:${ticket.channelId}`).setLabel(ticket.locked ? "Unlock" : "Lock").setEmoji("🔐").setStyle(ButtonStyle.Secondary)
    ),
  ];
}

async function refreshControlPanel(channel, ticket) {
  const messages = await channel.messages.fetch({ limit: 20 }).catch(() => null);
  const panel = messages?.find((item) => item.author.bot && item.embeds[0]?.author?.name === "Ticket Control Panel");
  if (panel) await panel.edit({ embeds: [buildControlPanel(ticket, channel.guild)], components: buildButtons(ticket), allowedMentions: { parse: [] } });
}

async function saveTranscript(channel) {
  const messages = await channel.messages.fetch({ limit: 100 });
  const lines = [...messages.values()].reverse().map((message) => {
    const timestamp = message.createdAt.toISOString();
    const body = message.cleanContent || "[attachment or embed]";
    return `[${timestamp}] ${message.author.tag}: ${body}`;
  });
  const attachment = new AttachmentBuilder(Buffer.from(lines.join("\n"), "utf8"), { name: `${channel.name}-transcript.txt` });
  const logChannel = await channel.guild.channels.fetch(TICKET_LOG_CHANNEL).catch(() => null);
  if (!logChannel?.isTextBased()) throw new Error("Ticket log channel is unavailable.");
  await logChannel.send({ content: `Transcript for <#${channel.id}>`, files: [attachment], allowedMentions: { parse: [] } });
}

function ticketId(interaction, prefix) {
  return interaction.customId.slice(prefix.length);
}

module.exports = {
  name: "ticket",
  aliases: ["tickets", "tk"],
  guildOnly: true,

  async execute(message) {
    if (!isOwner(message)) return message.reply("This command is restricted to the bot owner.");
    await ensureGuild(message.guild.id);
    await message.delete().catch(() => null);
    const embed = new EmbedBuilder()
      .setTitle("🎫 Open a Support Ticket")
      .setColor(0x5865f2)
      .setDescription("Choose the category that best fits your issue. The created channel is visible only to you, staff, and the bot.");
    const menu = new StringSelectMenuBuilder()
      .setCustomId("ticket_open_select")
      .setPlaceholder("Select a ticket category...")
      .addOptions(TICKET_CATEGORIES.map((item) => ({ label: item.label, description: item.description, value: item.value, emoji: item.emoji })));
    await message.channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)], allowedMentions: { parse: [] } });
  },

  selectMenuHandlers: [
    {
      customId: "ticket_open_select",
      async execute(interaction) {
        if (interaction.values[0] === "reset") {
          return interaction.reply({ content: "Select menu has been reset.", flags: 64 });
        }
        await interaction.deferReply({ flags: 64 });
        await ensureGuild(interaction.guild.id);
        const existing = await findActiveTicket(interaction.guild, interaction.user.id);
        if (existing) return interaction.editReply({ content: `You already have an open ticket: <#${existing.channelId}>`, allowedMentions: { parse: [] } });

        const category = interaction.values[0];
        const safeUser = interaction.user.username.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").slice(0, 40);
        const channel = await interaction.guild.channels.create({
          name: `${category}-${safeUser}-${Date.now().toString().slice(-6)}`,
          type: ChannelType.GuildText,
          parent: TICKET_CATEGORY_ID,
          topic: `Ticket opened by ${interaction.user.tag} | User ID: ${interaction.user.id} | Category: ${category}`,
          permissionOverwrites: [
            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.EmbedLinks] },
            { id: CLAIMER_ROLE_ID, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageMessages] },
            { id: interaction.client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels, PermissionsBitField.Flags.ManageMessages] },
          ],
          reason: `Support ticket opened by ${interaction.user.tag}`,
        });

        const ticket = await prisma.ticketChannel.create({
          data: {
            guildId: interaction.guild.id,
            channelId: channel.id,
            userId: interaction.user.id,
            category,
            name: channel.name,
            priority: "medium",
          },
        });
        await channel.send({ content: `<@${interaction.user.id}>`, embeds: [buildControlPanel(ticket, interaction.guild)], components: buildButtons(ticket), allowedMentions: { users: [interaction.user.id] } });
        await interaction.editReply({ content: `Your private ticket is ready: <#${channel.id}>`, allowedMentions: { parse: [] } });
      },
    },
    {
      customIdPrefix: "ticket_priority_select:",
      selectType: "string",
      async execute(interaction) {
        if (!isStaff(interaction)) return interaction.reply({ content: "Staff only.", flags: 64 });
        if (interaction.values[0] === "reset") {
          return interaction.update({ content: "Priority selection reset.", components: [] });
        }
        const channelId = ticketId(interaction, "ticket_priority_select:");
        const ticket = await prisma.ticketChannel.update({ where: { channelId }, data: { priority: interaction.values[0] } });
        await interaction.update({ content: `Priority set to ${PRIORITY_LABELS[ticket.priority].label}.`, components: [] });
        await refreshControlPanel(interaction.channel, ticket);
      },
    },
  ],

  buttonHandlers: [
    {
      customIdPrefix: "ticket_close:",
      async execute(interaction) {
        const ticket = await getTicket(ticketId(interaction, "ticket_close:"));
        if (!ticket) return interaction.reply({ content: "Ticket state was not found.", flags: 64 });
        if (interaction.user.id !== ticket.userId && !isStaff(interaction)) return interaction.reply({ content: "Only the opener or staff can close this ticket.", flags: 64 });
        await interaction.reply({ content: "Closing ticket and saving its state...", flags: 64 });
        await prisma.ticketChannel.update({ where: { channelId: ticket.channelId }, data: { closed: true, closedAt: new Date() } });
        await interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`);
      },
    },
    {
      customIdPrefix: "ticket_claim:",
      async execute(interaction) {
        if (!isStaff(interaction)) return interaction.reply({ content: "Staff only.", flags: 64 });
        const channelId = ticketId(interaction, "ticket_claim:");
        const current = await getTicket(channelId);
        const claimedBy = current.claimedBy === interaction.user.id ? null : interaction.user.id;
        const ticket = await prisma.ticketChannel.update({ where: { channelId }, data: { claimedBy } });
        await interaction.reply({ content: claimedBy ? `Claimed by <@${claimedBy}>.` : "Ticket unclaimed.", allowedMentions: { users: claimedBy ? [claimedBy] : [] } });
        await refreshControlPanel(interaction.channel, ticket);
      },
    },
    {
      customIdPrefix: "ticket_priority:",
      async execute(interaction) {
        if (!isStaff(interaction)) return interaction.reply({ content: "Staff only.", flags: 64 });
        const channelId = ticketId(interaction, "ticket_priority:");
        const menu = new StringSelectMenuBuilder().setCustomId(`ticket_priority_select:${channelId}`).setPlaceholder("Choose priority...").addOptions([
          ...Object.entries(PRIORITY_LABELS).map(([value, data]) => ({ label: data.label, value })),
          { label: "Reset", description: "Reset the select menu", value: "reset", emoji: "🔄" },
        ]);
        await interaction.reply({ content: "Select a priority:", components: [new ActionRowBuilder().addComponents(menu)], flags: 64 });
      },
    },
    {
      customIdPrefix: "ticket_lock:",
      async execute(interaction) {
        if (!isStaff(interaction)) return interaction.reply({ content: "Staff only.", flags: 64 });
        const channelId = ticketId(interaction, "ticket_lock:");
        const current = await getTicket(channelId);
        const locked = !current.locked;
        await interaction.channel.permissionOverwrites.edit(current.userId, { SendMessages: !locked }, { reason: `Ticket ${locked ? "locked" : "unlocked"} by ${interaction.user.tag}` });
        const ticket = await prisma.ticketChannel.update({ where: { channelId }, data: { locked } });
        await interaction.reply({ content: locked ? "Ticket locked." : "Ticket unlocked." });
        await refreshControlPanel(interaction.channel, ticket);
      },
    },
    {
      customIdPrefix: "ticket_escalate:",
      async execute(interaction) {
        if (!isStaff(interaction)) return interaction.reply({ content: "Staff only.", flags: 64 });
        const channelId = ticketId(interaction, "ticket_escalate:");
        const ticket = await getTicket(channelId);
        if (!ticket) return interaction.reply({ content: "Ticket state was not found.", flags: 64 });

        const modal = new ModalBuilder()
          .setCustomId(`ticket_escalate_reason:${channelId}`)
          .setTitle("Escalate Ticket")
          .addComponents(
            new ActionRowBuilder().addComponents(
              new TextInputBuilder()
                .setCustomId("reason")
                .setLabel("Escalation reason")
                .setPlaceholder("Explain why this ticket needs admin attention")
                .setStyle(TextInputStyle.Paragraph)
                .setMinLength(3)
                .setMaxLength(1000)
                .setRequired(true)
            )
          );
        await interaction.showModal(modal);
      },
    },
    {
      customIdPrefix: "ticket_transcript:",
      async execute(interaction) {
        if (!isStaff(interaction)) return interaction.reply({ content: "Staff only.", flags: 64 });
        await interaction.deferReply({ flags: 64 });
        try {
          await saveTranscript(interaction.channel);
          await interaction.editReply("Transcript saved.");
        } catch (error) {
          await interaction.editReply(error.message || "Could not save transcript.");
        }
      },
    },
    {
      customIdPrefix: "ticket_adduser:",
      async execute(interaction) {
        if (!isStaff(interaction)) return interaction.reply({ content: "Staff only.", flags: 64 });
        const channelId = ticketId(interaction, "ticket_adduser:");
        const modal = new ModalBuilder().setCustomId(`ticket_adduser_modal:${channelId}`).setTitle("Add User to Ticket").addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("user_id").setLabel("Discord user ID").setStyle(TextInputStyle.Short).setRequired(true))
        );
        await interaction.showModal(modal);
      },
    },
    {
      customIdPrefix: "ticket_removeuser:",
      async execute(interaction) {
        if (!isStaff(interaction)) return interaction.reply({ content: "Staff only.", flags: 64 });
        const channelId = ticketId(interaction, "ticket_removeuser:");
        const modal = new ModalBuilder().setCustomId(`ticket_removeuser_modal:${channelId}`).setTitle("Remove User from Ticket").addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId("user_id").setLabel("Discord user ID").setStyle(TextInputStyle.Short).setRequired(true))
        );
        await interaction.showModal(modal);
      },
    },
  ],

  modalHandlers: [
    {
      customIdPrefix: "ticket_escalate_reason:",
      async execute(interaction) {
        if (!isStaff(interaction)) return interaction.reply({ content: "Staff only.", flags: 64 });
        const channelId = ticketId(interaction, "ticket_escalate_reason:");
        const roleId = ESCALATION_ROLE_ID;
        const ticket = await getTicket(channelId);
        if (!ticket) return interaction.reply({ content: "Ticket state was not found.", flags: 64 });
        if (interaction.channel.id !== channelId) return interaction.reply({ content: "This escalation does not belong to the current ticket channel.", flags: 64 });

        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) return interaction.reply({ content: "The configured escalation role no longer exists.", flags: 64 });

        const reason = interaction.fields.getTextInputValue("reason").trim();
        if (!reason) return interaction.reply({ content: "An escalation reason is required.", flags: 64 });

        await interaction.deferReply({ flags: 64 });
        await interaction.channel.permissionOverwrites.edit(
          roleId,
          {
            ViewChannel: true,
            SendMessages: true,
            ReadMessageHistory: true,
            AttachFiles: true,
            EmbedLinks: true,
          },
          { reason: `Ticket escalated to ${role.name} by ${interaction.user.tag}` }
        );

        const escalatedName = interaction.channel.name.startsWith("escalate-")
          ? interaction.channel.name
          : `escalate-${interaction.channel.name}`.slice(0, 100);
        if (escalatedName !== interaction.channel.name) {
          await interaction.channel.setName(escalatedName, `Ticket escalated by ${interaction.user.tag}`);
        }

        const updatedTicket = await prisma.ticketChannel.update({
          where: { channelId },
          data: { escalated: true, priority: "critical", name: escalatedName },
        });
        await refreshControlPanel(interaction.channel, updatedTicket);

        const notificationEmbed = new EmbedBuilder()
          .setTitle("🚨 Ticket Escalated")
          .setColor(PRIORITY_LABELS.critical.color)
          .setDescription(`A support ticket has been escalated to <@&${roleId}>.`)
          .addFields(
            { name: "Ticket", value: `<#${channelId}>`, inline: true },
            { name: "Escalated to", value: `<@&${roleId}>`, inline: true },
            { name: "Escalated by", value: `<@${interaction.user.id}>`, inline: true },
            { name: "Reason", value: reason, inline: false }
          )
          .setTimestamp();

        const notifications = await interaction.guild.channels.fetch(NOTIFICATIONS_CHANNEL_ID).catch(() => null);
        if (!notifications?.isTextBased()) {
          return interaction.editReply(`Ticket escalated to <@&${roleId}> and renamed to **${escalatedName}**, but the notifications channel is unavailable.`);
        }

        try {
          await notifications.send({
            content: `<@&${roleId}>`,
            embeds: [notificationEmbed],
            allowedMentions: { roles: [roleId] },
          });
          await interaction.editReply({
            content: `Ticket escalated to <@&${roleId}>, renamed to **${escalatedName}**, and the notification was sent.`,
            allowedMentions: { parse: [] },
          });
        } catch (error) {
          await interaction.editReply({
            content: `Ticket escalated to <@&${roleId}> and renamed to **${escalatedName}**, but the notification could not be sent.`,
            allowedMentions: { parse: [] },
          });
        }
      },
    },
    {
      customIdPrefix: "ticket_adduser_modal:",
      async execute(interaction) {
        if (!isStaff(interaction)) return interaction.reply({ content: "Staff only.", flags: 64 });
        const userId = interaction.fields.getTextInputValue("user_id").trim();
        if (!/^\d{17,20}$/.test(userId)) return interaction.reply({ content: "Enter a valid Discord user ID.", flags: 64 });
        await interaction.channel.permissionOverwrites.edit(userId, { ViewChannel: true, SendMessages: true, ReadMessageHistory: true }, { reason: `Added by ${interaction.user.tag}` });
        await interaction.reply({ content: `<@${userId}> was added to the ticket.`, allowedMentions: { users: [userId] } });
      },
    },
    {
      customIdPrefix: "ticket_removeuser_modal:",
      async execute(interaction) {
        if (!isStaff(interaction)) return interaction.reply({ content: "Staff only.", flags: 64 });
        const channelId = ticketId(interaction, "ticket_removeuser_modal:");
        const ticket = await getTicket(channelId);
        if (!ticket) return interaction.reply({ content: "Ticket state was not found.", flags: 64 });

        const userId = interaction.fields.getTextInputValue("user_id").trim();
        if (!/^\d{17,20}$/.test(userId)) return interaction.reply({ content: "Enter a valid Discord user ID.", flags: 64 });
        if (userId === ticket.userId) return interaction.reply({ content: "The ticket opener cannot be removed. Close the ticket instead.", flags: 64 });
        if (userId === interaction.client.user.id) return interaction.reply({ content: "The bot cannot be removed from its own ticket.", flags: 64 });

        const overwrite = interaction.channel.permissionOverwrites.cache.get(userId);
        if (!overwrite || overwrite.type !== OverwriteType.Member) {
          return interaction.reply({ content: "That user does not have a direct ticket permission override.", flags: 64 });
        }

        await interaction.channel.permissionOverwrites.delete(userId, `Removed from ticket by ${interaction.user.tag}`);
        await interaction.reply({ content: `<@${userId}> was removed from the ticket.`, allowedMentions: { parse: [] } });
      },
    },
  ],
};
