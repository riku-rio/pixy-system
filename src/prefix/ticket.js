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
} = require("discord.js");

// ─── CONFIG ───────────────────────────────────────────────────────────────────
const TICKET_CATEGORY_ID   = "1528706907404242955"; // Ticket category (fully private)
const TICKET_OPENER_ROLE   = "1528706965277114478"; // Role given so only opener sees their ticket
const CLAIMER_ROLE_ID      = "1528708288814776411"; // Admin/staff role that can claim tickets
const TICKET_LOG_CHANNEL        = "1528712602157449286"; // Channel where transcripts are archived
const NOTIFICATIONS_CHANNEL_ID  = "1528732283513733221"; // #pixy-notifications — escalation alerts

// Ticket category options shown in the opener select menu
const TICKET_CATEGORIES = [
  { label: "🛟  General Support",   description: "Get help with general questions",          value: "general",   emoji: "🛟"  },
  { label: "🐛  Bug Report",         description: "Report a bug or unexpected behaviour",     value: "bug",       emoji: "🐛"  },
  // { label: "💸  Billing / Purchase", description: "Questions about payments or purchases",    value: "billing",   emoji: "💸"  },
  { label: "📋  Other",              description: "Something that doesn't fit above",         value: "other",     emoji: "📋"  },
];

// Priority label map
const PRIORITY_LABELS = {
  low:      { label: "🟢 Low",      color: 0x57f287 },
  medium:   { label: "🟡 Medium",   color: 0xfee75c },
  high:     { label: "🔴 High",     color: 0xed4245 },
  critical: { label: "🚨 Critical", color: 0xff4444 },
};

// In-memory ticket store  { channelId → ticketData }
// ticketData: { openerUserId, category, claimedBy, priority, channelId, guildId, openedAt, name }
const ticketStore = new Map();

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function isOwner(message) {
  const ownerId = message.client.appEnv?.ownerId;
  return ownerId && message.author.id === ownerId;
}

/** Build the control-panel embed for a ticket channel */
function buildControlPanel(ticket, guild) {
  const opener = guild.members.cache.get(ticket.openerUserId);
  const cat    = TICKET_CATEGORIES.find((c) => c.value === ticket.category) || { label: ticket.category };
  const priData = PRIORITY_LABELS[ticket.priority] || PRIORITY_LABELS.medium;
  const ts      = Math.floor(new Date(ticket.openedAt).getTime() / 1000);

  return new EmbedBuilder()
    .setAuthor({ name: "Ticket Control Panel", iconURL: guild.iconURL({ dynamic: true }) })
    .setTitle(`${cat.emoji || "🎫"}  ${ticket.name}`)
    .setColor(priData.color)
    .setDescription(
      `Welcome to your ticket!\nA staff member will be with you shortly.\n\n` +
      `Use the buttons below to manage this ticket.`
    )
    .addFields(
      { name: "👤 Opened by",   value: opener ? `<@${opener.id}>` : `<@${ticket.openerUserId}>`, inline: true  },
      { name: "📂 Category",    value: cat.label,                                                  inline: true  },
      { name: "📊 Priority",    value: priData.label,                                              inline: true  },
      {
        name:   "🧑‍💼 Claimed by",
        value:  ticket.claimedBy ? `<@${ticket.claimedBy}>` : "*Unclaimed — available for staff*",
        inline: false,
      },
      { name: "🕐 Opened",      value: `<t:${ts}:F> (<t:${ts}:R>)`,                               inline: false },
    )
    .setFooter({ text: `Ticket ID: ${ticket.channelId}` })
    .setTimestamp();
}

/** Build the row of control-panel buttons */
function buildControlButtons(ticket) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_close:${ticket.channelId}`)
      .setLabel("Close Ticket")
      .setEmoji("🔒")
      .setStyle(ButtonStyle.Danger),

    new ButtonBuilder()
      .setCustomId(`ticket_claim:${ticket.channelId}`)
      .setLabel(ticket.claimedBy ? "Unclaim" : "Claim Ticket")
      .setEmoji(ticket.claimedBy ? "✋" : "🙋")
      .setStyle(ticket.claimedBy ? ButtonStyle.Secondary : ButtonStyle.Success),

    new ButtonBuilder()
      .setCustomId(`ticket_escalate:${ticket.channelId}`)
      .setLabel("Escalate")
      .setEmoji("🚨")
      .setStyle(ButtonStyle.Primary),

    new ButtonBuilder()
      .setCustomId(`ticket_priority:${ticket.channelId}`)
      .setLabel("Set Priority")
      .setEmoji("📊")
      .setStyle(ButtonStyle.Secondary),
  );

  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_adduser:${ticket.channelId}`)
      .setLabel("Add User")
      .setEmoji("🥏")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`ticket_transcript:${ticket.channelId}`)
      .setLabel("Save Transcript")
      .setEmoji("📄")
      .setStyle(ButtonStyle.Secondary),

    new ButtonBuilder()
      .setCustomId(`ticket_lock:${ticket.channelId}`)
      .setLabel("Lock / Unlock")
      .setEmoji("🔐")
      .setStyle(ButtonStyle.Secondary),
  );

  return [row1, row2];
}

/** Refresh the control-panel message in the ticket channel */
async function refreshControlPanel(channel, ticket) {
  try {
    const messages = await channel.messages.fetch({ limit: 10 });
    const panel    = messages.find(
      (m) => m.author.bot && m.embeds[0]?.author?.name === "Ticket Control Panel"
    );

    const newEmbed   = buildControlPanel(ticket, channel.guild);
    const newButtons = buildControlButtons(ticket);

    if (panel) {
      await panel.edit({ embeds: [newEmbed], components: newButtons });
    }
  } catch { /* ignore */ }
}

/** Check whether an interaction user has the claimer (staff) role */
function isStaff(interaction) {
  return (
    interaction.member?.roles?.cache?.has(CLAIMER_ROLE_ID) ||
    interaction.member?.permissions?.has(PermissionsBitField.Flags.Administrator)
  );
}

// ─── MODULE EXPORT ────────────────────────────────────────────────────────────

module.exports = {
  name:     "ticket",
  aliases:  ["tickets", "tk"],
  guildOnly: true,
  guildOnlyMessage: "This command can only be used inside a server.",

  async execute(message, args) {
    // Owner-only guard
    if (!isOwner(message)) {
      return message.reply({
        embeds: [
          new EmbedBuilder()
            .setDescription("❌ This command is restricted to the **bot owner**.")
            .setColor(0xed4245),
        ],
        flags: 64,
      });
    }

    // Delete the trigger message for a clean look
    try { await message.delete(); } catch { /* missing permissions, ignore */ }

    // ── Opener embed ────────────────────────────────────────────────────
    const openerEmbed = new EmbedBuilder()
      .setAuthor({
        name: message.guild.name + " — Support Tickets",
        iconURL: message.guild.iconURL({ dynamic: true }),
      })
      .setTitle("🎫  Open a Support Ticket")
      .setColor(0x5865f2)
      .setDescription(
        "Need help? We've got you covered!\n\n" +
        "Select the category that best fits your issue from the menu below.\n" +
        "A private channel will be created just for you and our support team.\n\n" +
        "> 🔒 Your ticket will be **private** — only you and staff can see it.\n" +
        "> ⏱️ We aim to respond within **24 hours**.\n" +
        "> 📌 Please be descriptive so we can help you faster."
      )
      .addFields(
        { name: "📂 Available Categories", value: TICKET_CATEGORIES.map((c) => `${c.emoji}  **${c.label.replace(/^.{3}/, "").trim()}**`).join("\n"), inline: false }
      )
      .setFooter({ text: "Do not open duplicate tickets • Abuse will result in a ban" })
      .setTimestamp();

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("ticket_open_select")
      .setPlaceholder("📌 Select a category to open your ticket...")
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        TICKET_CATEGORIES.map((c) => ({
          label:       c.label,
          description: c.description,
          value:       c.value,
          emoji:       { name: c.emoji.replace(/\uFE0F/g, "").trim() },
        }))
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    await message.channel.send({ embeds: [openerEmbed], components: [row] });
  },

  // ─────────────────────────────────────────────────────────────────────
  //  SELECT MENU HANDLERS
  // ─────────────────────────────────────────────────────────────────────
  selectMenuHandlers: [
    {
      customId: "ticket_open_select",
      async execute(interaction) {
        const category = interaction.values[0];
        const guild    = interaction.guild;
        const member   = interaction.member;
        const user     = interaction.user;

        // Prevent duplicate tickets
        const existing = [...ticketStore.values()].find(
          (t) => t.openerUserId === user.id && t.guildId === guild.id
        );
        if (existing) {
          return interaction.reply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`❌ You already have an open ticket: <#${existing.channelId}>\nPlease use it or wait until it's closed.`)
                .setColor(0xed4245),
            ],
            flags: 64,
          });
        }

        await interaction.deferReply({ flags: 64 });

        const cat         = TICKET_CATEGORIES.find((c) => c.value === category) || { label: category, emoji: "🎫" };
        const ticketNumber = Date.now().toString().slice(-6);
        const channelName  = `${cat.emoji.replace(/\uFE0F/g, "").trim().toLowerCase()}-${user.username.toLowerCase().replace(/\s+/g, "-")}-${ticketNumber}`;

        try {
          // Fetch category channel
          const categoryChannel = await guild.channels.fetch(TICKET_CATEGORY_ID).catch(() => null);
          if (!categoryChannel) {
            return interaction.editReply({ content: "❌ Ticket category not found. Please contact an administrator." });
          }

          // Build permission overwrites
          const overwrites = [
            {
              id:   guild.id, // @everyone — deny
              deny: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id:    user.id, // Opener
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.EmbedLinks,
              ],
            },
            {
              id:    TICKET_OPENER_ROLE, // ticket-opener role (redundant safety belt)
              allow: [PermissionsBitField.Flags.ViewChannel],
            },
            {
              id:    CLAIMER_ROLE_ID, // All admins / claimers
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.AttachFiles,
                PermissionsBitField.Flags.EmbedLinks,
              ],
            },
            {
              id:    interaction.client.user.id, // Bot itself
              allow: [
                PermissionsBitField.Flags.ViewChannel,
                PermissionsBitField.Flags.SendMessages,
                PermissionsBitField.Flags.ManageChannels,
                PermissionsBitField.Flags.ManageMessages,
                PermissionsBitField.Flags.ReadMessageHistory,
                PermissionsBitField.Flags.EmbedLinks,
                PermissionsBitField.Flags.AttachFiles,
              ],
            },
          ];

          // Give opener the ticket-opener role so they can see only their channel
          try { await member.roles.add(TICKET_OPENER_ROLE); } catch { /* role missing */ }

          // Create the ticket channel
          const ticketChannel = await guild.channels.create({
            name:                 channelName,
            type:                 ChannelType.GuildText,
            parent:               TICKET_CATEGORY_ID,
            topic:                `Ticket opened by ${user.tag} | Category: ${cat.label} | ID: ${user.id}`,
            permissionOverwrites: overwrites,
            reason:               `Ticket opened by ${user.tag} in category ${cat.label}`,
          });

          // Store ticket
          const ticketData = {
            channelId:    ticketChannel.id,
            guildId:      guild.id,
            openerUserId: user.id,
            category,
            claimedBy:    null,
            priority:     "medium",
            openedAt:     new Date().toISOString(),
            name:         channelName,
            locked:       false,
          };
          ticketStore.set(ticketChannel.id, ticketData);

          // Send control panel
          const controlEmbed   = buildControlPanel(ticketData, guild);
          const controlButtons = buildControlButtons(ticketData);

          const pinMsg = await ticketChannel.send({
            content:    `<@${user.id}> — Welcome! Support will be with you shortly.`,
            embeds:     [controlEmbed],
            components: controlButtons,
          });

          try { await pinMsg.pin(); } catch { /* can't pin */ }

          // Confirm to opener
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle("✅ Ticket Created!")
                .setDescription(`Your ticket has been opened in <#${ticketChannel.id}>.\nPlease describe your issue there.`)
                .setColor(0x57f287)
                .setTimestamp(),
            ],
          });

        } catch (err) {
          console.error("[ticket] Failed to create ticket channel:", err);
          await interaction.editReply({ content: "❌ Something went wrong while creating your ticket. Please try again." });
        }
      },
    },

    // Priority select menu (shown after clicking "Set Priority")
    {
      customId: "ticket_priority_select",
      async execute(interaction) {
        if (!isStaff(interaction)) {
          return interaction.reply({ content: "❌ Only staff can set the priority.", flags: 64 });
        }

        const ticket = ticketStore.get(interaction.channelId);
        if (!ticket) return interaction.reply({ content: "❌ This is not a tracked ticket.", flags: 64 });

        ticket.priority = interaction.values[0];
        await interaction.deferUpdate();
        await refreshControlPanel(interaction.channel, ticket);
      },
    },
  ],

  // ─────────────────────────────────────────────────────────────────────
  //  BUTTON HANDLERS
  // ─────────────────────────────────────────────────────────────────────
  buttonHandlers: [

    // ── CLOSE ────────────────────────────────────────────────────────
    {
      customIdPrefix: "ticket_close:",
      async execute(interaction) {
        const channelId = interaction.customId.split(":")[1];
        const ticket    = ticketStore.get(channelId);

        if (!ticket) return interaction.reply({ content: "❌ Ticket data not found.", flags: 64 });

        const isOpener = interaction.user.id === ticket.openerUserId;
        if (!isStaff(interaction) && !isOpener) {
          return interaction.reply({ content: "❌ Only the ticket opener or staff can close this ticket.", flags: 64 });
        }

        // Confirmation embed
        const confirmEmbed = new EmbedBuilder()
          .setTitle("🔒 Close Ticket?")
          .setDescription("This will **permanently delete** the ticket channel after 5 seconds.\nAll messages will be lost unless a transcript was saved.")
          .setColor(0xed4245)
          .setTimestamp();

        const confirmRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId(`ticket_close_confirm:${channelId}`)
            .setLabel("Yes, Close It")
            .setEmoji("🔒")
            .setStyle(ButtonStyle.Danger),
          new ButtonBuilder()
            .setCustomId(`ticket_close_cancel:${channelId}`)
            .setLabel("Cancel")
            .setEmoji("❌")
            .setStyle(ButtonStyle.Secondary),
        );

        await interaction.reply({ embeds: [confirmEmbed], components: [confirmRow], flags: 64 });
      },
    },

    // ── CLOSE CONFIRM ────────────────────────────────────────────────
    {
      customIdPrefix: "ticket_close_confirm:",
      async execute(interaction) {
        const channelId = interaction.customId.split(":")[1];
        const ticket    = ticketStore.get(channelId);

        if (!ticket) return interaction.reply({ content: "❌ Ticket data not found.", flags: 64 });

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription("🔒 Ticket is being closed... This channel will be deleted in **5 seconds**.")
              .setColor(0xed4245),
          ],
        });

        // Remove opener's ticket-opener role
        try {
          const opener = await interaction.guild.members.fetch(ticket.openerUserId);
          await opener.roles.remove(TICKET_OPENER_ROLE);
        } catch { /* member left or role gone */ }

        ticketStore.delete(channelId);

        await new Promise((r) => setTimeout(r, 5000));
        try { await interaction.channel.delete(`Ticket closed by ${interaction.user.tag}`); } catch { /* already gone */ }
      },
    },

    // ── CLOSE CANCEL ────────────────────────────────────────────────
    {
      customIdPrefix: "ticket_close_cancel:",
      async execute(interaction) {
        await interaction.update({ content: "❌ Close cancelled.", embeds: [], components: [] });
      },
    },

    // ── CLAIM / UNCLAIM ───────────────────────────────────────────────
    {
      customIdPrefix: "ticket_claim:",
      async execute(interaction) {
        if (!isStaff(interaction)) {
          return interaction.reply({ content: "❌ Only staff with the claimer role can claim tickets.", flags: 64 });
        }

        const channelId = interaction.customId.split(":")[1];
        const ticket    = ticketStore.get(channelId);
        if (!ticket) return interaction.reply({ content: "❌ Ticket data not found.", flags: 64 });

        await interaction.deferReply({ flags: 64 });

        if (ticket.claimedBy === interaction.user.id) {
          // Unclaim
          ticket.claimedBy = null;
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setDescription("✋ You have **unclaimed** this ticket.")
                .setColor(0xfee75c),
            ],
          });
        } else if (ticket.claimedBy) {
          // Already claimed by someone else
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`❌ This ticket is already claimed by <@${ticket.claimedBy}>.`)
                .setColor(0xed4245),
            ],
          });
          return;
        } else {
          // Claim
          ticket.claimedBy = interaction.user.id;
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`✅ <@${interaction.user.id}> has **claimed** this ticket.`)
                .setColor(0x57f287),
            ],
          });
        }

        await refreshControlPanel(interaction.channel, ticket);
      },
    },

    // ── ESCALATE ──────────────────────────────────────────────────────
    {
      customIdPrefix: "ticket_escalate:",
      async execute(interaction) {
        // Only staff with the claimer role (or admin) can escalate — users cannot
        if (!isStaff(interaction)) {
          return interaction.reply({ content: "❌ Only staff with the **Claimer** role can escalate tickets.", flags: 64 });
        }

        const channelId = interaction.customId.split(":")[1];
        const ticket    = ticketStore.get(channelId);
        if (!ticket) return interaction.reply({ content: "❌ Ticket data not found.", flags: 64 });

        ticket.priority = "critical";

        const cat    = TICKET_CATEGORIES.find((c) => c.value === ticket.category) || { label: ticket.category, emoji: "🎫" };
        const openedTs = Math.floor(new Date(ticket.openedAt).getTime() / 1000);

        // ── Visible notice inside the ticket channel ──────────────────
        const ticketEmbed = new EmbedBuilder()
          .setTitle("🚨 Ticket Escalated")
          .setDescription(
            `This ticket has been **escalated** by <@${interaction.user.id}> and marked as **🚨 Critical**.\n` +
            `The admin team has been alerted in <#${NOTIFICATIONS_CHANNEL_ID}>.`
          )
          .setColor(0xff4444)
          .setTimestamp();

        await interaction.reply({ embeds: [ticketEmbed] });
        await refreshControlPanel(interaction.channel, ticket);

        // ── Post full alert to #pixy-notifications ────────────────────
        try {
          const notifChannel = await interaction.client.channels.fetch(NOTIFICATIONS_CHANNEL_ID);

          const notifEmbed = new EmbedBuilder()
            .setAuthor({
              name: "🚨 Ticket Escalated — Immediate Attention Required",
              iconURL: interaction.guild.iconURL({ dynamic: true }),
            })
            .setTitle(`Escalated: #${interaction.channel.name}`)
            .setColor(0xff4444)
            .addFields(
              { name: "📌 Ticket Channel",  value: `<#${channelId}>`,                                                           inline: true  },
              { name: "👤 Opened by",       value: `<@${ticket.openerUserId}>`,                                                  inline: true  },
              { name: "📂 Category",        value: cat.label,                                                                    inline: true  },
              { name: "🧑‍💼 Claimed by",     value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "*Unclaimed*",                 inline: true  },
              { name: "⚡ Escalated by",   value: `<@${interaction.user.id}>`,                                                  inline: true  },
              { name: "🕐 Ticket opened",   value: `<t:${openedTs}:F> (<t:${openedTs}:R>)`,                                     inline: false },
            )
            .setFooter({ text: `Ticket ID: ${channelId}` })
            .setTimestamp();

          await notifChannel.send({
            content: `<@&${CLAIMER_ROLE_ID}> — 🚨 A ticket has been **escalated** and requires **immediate attention**!`,
            embeds:  [notifEmbed],
          });
        } catch (err) {
          console.error("[ticket] Could not post escalation to notifications channel:", err.message);
        }
      },
    },

    // ── SET PRIORITY ──────────────────────────────────────────────────
    {
      customIdPrefix: "ticket_priority:",
      async execute(interaction) {
        if (!isStaff(interaction)) {
          return interaction.reply({ content: "❌ Only staff can set priority.", flags: 64 });
        }

        const channelId = interaction.customId.split(":")[1];
        const ticket    = ticketStore.get(channelId);
        if (!ticket) return interaction.reply({ content: "❌ Ticket data not found.", flags: 64 });

        const priorityMenu = new StringSelectMenuBuilder()
          .setCustomId("ticket_priority_select")
          .setPlaceholder("Choose a priority level...")
          .addOptions([
            { label: "🟢 Low",      value: "low",      description: "Non-urgent, can wait"              },
            { label: "🟡 Medium",   value: "medium",   description: "Normal priority (default)"         },
            { label: "🔴 High",     value: "high",     description: "Needs attention soon"              },
            { label: "🚨 Critical", value: "critical", description: "Urgent — requires immediate action" },
          ]);

        const row = new ActionRowBuilder().addComponents(priorityMenu);

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setDescription("📊 Select a priority level for this ticket:")
              .setColor(0x5865f2),
          ],
          components: [row],
          flags: 64,
        });
      },
    },

    // ── ADD USER ──────────────────────────────────────────────────────
    {
      customIdPrefix: "ticket_adduser:",
      async execute(interaction) {
        if (!isStaff(interaction)) {
          return interaction.reply({ content: "❌ Only staff can add users to tickets.", flags: 64 });
        }

        const channelId = interaction.customId.split(":")[1];
        const ticket    = ticketStore.get(channelId);
        if (!ticket) return interaction.reply({ content: "❌ Ticket data not found.", flags: 64 });

        const modal = new ModalBuilder()
          .setCustomId(`ticket_adduser_modal:${channelId}`)
          .setTitle("Add User to Ticket");

        const userInput = new TextInputBuilder()
          .setCustomId("add_user_id")
          .setLabel("User ID or mention (@username)")
          .setPlaceholder("Enter a user ID (e.g. 123456789012345678)")
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(32);

        modal.addComponents(new ActionRowBuilder().addComponents(userInput));
        await interaction.showModal(modal);
      },
    },

    // ── TRANSCRIPT ────────────────────────────────────────────────────
    {
      customIdPrefix: "ticket_transcript:",
      async execute(interaction) {
        if (!isStaff(interaction)) {
          return interaction.reply({ content: "❌ Only staff can save transcripts.", flags: 64 });
        }

        const channelId = interaction.customId.split(":")[1];
        const ticket    = ticketStore.get(channelId);
        if (!ticket) return interaction.reply({ content: "❌ Ticket data not found.", flags: 64 });

        await interaction.deferReply({ flags: 64 });

        try {
          const messages = await interaction.channel.messages.fetch({ limit: 100 });
          const sorted   = [...messages.values()].sort((a, b) => a.createdTimestamp - b.createdTimestamp);

          const cat    = TICKET_CATEGORIES.find((c) => c.value === ticket.category) || { label: ticket.category, emoji: "🎫" };
          const savedAt = new Date();
          const savedTs = Math.floor(savedAt.getTime() / 1000);
          const openedTs = Math.floor(new Date(ticket.openedAt).getTime() / 1000);

          const lines = sorted.map((m) => {
            const ts      = new Date(m.createdTimestamp).toISOString();
            const content = m.content || (m.embeds.length ? "[Embed]" : "[Attachment]");
            return `[${ts}] ${m.author.tag}: ${content}`;
          });

          const transcriptText = [
            `=== TICKET TRANSCRIPT ===`,
            `Channel  : #${interaction.channel.name}`,
            `Channel ID: ${channelId}`,
            `Opened by : ${ticket.openerUserId}`,
            `Category  : ${cat.label}`,
            `Claimed by: ${ticket.claimedBy ?? "Unclaimed"}`,
            `Saved by  : ${interaction.user.tag} (${interaction.user.id})`,
            `Saved at  : ${savedAt.toISOString()}`,
            `Messages  : ${sorted.length}`,
            `========================`,
            "",
            ...lines,
          ].join("\n");

          const { AttachmentBuilder } = require("discord.js");
          const attachment = new AttachmentBuilder(
            Buffer.from(transcriptText, "utf-8"),
            { name: `transcript-${interaction.channel.name}.txt` }
          );

          // ── Ephemeral confirmation to the staff member ─────────────
          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setTitle("📄 Transcript Saved")
                .setDescription(
                  `Successfully captured **${sorted.length}** message(s).\n` +
                  `A copy has also been posted in <#${TICKET_LOG_CHANNEL}>.`
                )
                .setColor(0x5865f2)
                .setTimestamp(),
            ],
            files: [attachment],
          });

          // ── Archive copy in the log channel ────────────────────────
          try {
            const logChannel = await interaction.client.channels.fetch(TICKET_LOG_CHANNEL);

            const logEmbed = new EmbedBuilder()
              .setAuthor({
                name: "Ticket Transcript Archived",
                iconURL: interaction.guild.iconURL({ dynamic: true }),
              })
              .setTitle(`📄 #${interaction.channel.name}`)
              .setColor(0x5865f2)
              .addFields(
                { name: "👤 Opened by",   value: `<@${ticket.openerUserId}>`,                                              inline: true  },
                { name: "📂 Category",    value: cat.label,                                                                  inline: true  },
                { name: "🧑‍💼 Claimed by",  value: ticket.claimedBy ? `<@${ticket.claimedBy}>` : "*Unclaimed*",              inline: true  },
                { name: "🕐 Ticket opened", value: `<t:${openedTs}:F>`,                                                     inline: false },
                { name: "💾 Saved by",    value: `<@${interaction.user.id}>`,                                               inline: true  },
                { name: "🕐 Saved at",    value: `<t:${savedTs}:F> (<t:${savedTs}:R>)`,                                    inline: true  },
                { name: "💬 Messages",    value: `${sorted.length}`,                                                        inline: true  },
              )
              .setFooter({ text: `Channel ID: ${channelId}` })
              .setTimestamp();

            // Re-create attachment — streams can only be consumed once
            const logAttachment = new AttachmentBuilder(
              Buffer.from(transcriptText, "utf-8"),
              { name: `transcript-${interaction.channel.name}.txt` }
            );

            await logChannel.send({ embeds: [logEmbed], files: [logAttachment] });
          } catch (logErr) {
            console.error("[ticket] Could not post transcript to log channel:", logErr.message);
          }

        } catch (err) {
          console.error("[ticket] Transcript failed:", err);
          await interaction.editReply({ content: "❌ Failed to generate transcript." });
        }
      },
    },

    // ── LOCK / UNLOCK ─────────────────────────────────────────────────
    {
      customIdPrefix: "ticket_lock:",
      async execute(interaction) {
        if (!isStaff(interaction)) {
          return interaction.reply({ content: "❌ Only staff can lock/unlock tickets.", flags: 64 });
        }

        const channelId = interaction.customId.split(":")[1];
        const ticket    = ticketStore.get(channelId);
        if (!ticket) return interaction.reply({ content: "❌ Ticket data not found.", flags: 64 });

        await interaction.deferReply({ flags: 64 });

        ticket.locked = !ticket.locked;

        try {
          await interaction.channel.permissionOverwrites.edit(ticket.openerUserId, {
            SendMessages: !ticket.locked,
          });
        } catch { /* missing permissions */ }

        await interaction.editReply({
          embeds: [
            new EmbedBuilder()
              .setDescription(
                ticket.locked
                  ? "🔐 Ticket **locked** — the opener can no longer send messages."
                  : "🔓 Ticket **unlocked** — the opener can send messages again."
              )
              .setColor(ticket.locked ? 0xed4245 : 0x57f287),
          ],
        });

        // Post a visible notice in the ticket
        await interaction.channel.send({
          embeds: [
            new EmbedBuilder()
              .setDescription(
                ticket.locked
                  ? `🔐 <@${interaction.user.id}> has **locked** this ticket. Please wait for a response.`
                  : `🔓 <@${interaction.user.id}> has **unlocked** this ticket. You may continue.`
              )
              .setColor(ticket.locked ? 0xed4245 : 0x57f287),
          ],
        });
      },
    },
  ],

  // ─────────────────────────────────────────────────────────────────────
  //  MODAL HANDLERS
  // ─────────────────────────────────────────────────────────────────────
  modalHandlers: [

    // ── ADD USER MODAL ────────────────────────────────────────────────
    {
      customIdPrefix: "ticket_adduser_modal:",
      async execute(interaction) {
        const channelId = interaction.customId.split(":")[1];
        const ticket    = ticketStore.get(channelId);
        if (!ticket) return interaction.reply({ content: "❌ Ticket data not found.", flags: 64 });

        const raw    = interaction.fields.getTextInputValue("add_user_id").trim();
        const userId = raw.replace(/[<@!>]/g, ""); // strip mention formatting

        await interaction.deferReply({ flags: 64 });

        try {
          const member = await interaction.guild.members.fetch(userId);

          await interaction.channel.permissionOverwrites.edit(member.id, {
            ViewChannel:        true,
            SendMessages:       true,
            ReadMessageHistory: true,
            AttachFiles:        true,
            EmbedLinks:         true,
          });

          await interaction.editReply({
            embeds: [
              new EmbedBuilder()
                .setDescription(`✅ <@${member.id}> has been **added** to the ticket.`)
                .setColor(0x57f287),
            ],
          });

          await interaction.channel.send({
            embeds: [
              new EmbedBuilder()
                .setDescription(`🥏 <@${member.id}> was added to this ticket by <@${interaction.user.id}>.`)
                .setColor(0x5865f2),
            ],
          });

        } catch {
          await interaction.editReply({ content: "❌ Could not find that user. Make sure the ID is valid." });
        }
      },
    },

  ],
};
