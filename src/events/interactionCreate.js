const { Events, Collection } = require("discord.js");

const DEFAULT_ERROR_MESSAGE = "An error occurred while executing this interaction.";

function toArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function getCooldowns(client) {
  if (!client.cooldowns) {
    client.cooldowns = new Collection();
  }

  return client.cooldowns;
}

function getCooldownSeconds(entry) {
  return Number(entry?.cooldown || entry?.cooldownSeconds || 0);
}

function getCooldownId(interaction, entry, fallbackName) {
  return entry?.cooldownId || entry?.name || entry?.customId || entry?.sourceCommand || fallbackName;
}

async function safeReply(interaction, payload) {
  if (interaction.isAutocomplete?.()) {
    try {
      await interaction.respond([]);
    } catch {
      // Ignore autocomplete response errors
    }
    return;
  }

  const finalPayload =
    typeof payload === "string"
      ? { content: payload, flags: 64 }
      : { flags: 64, ...payload };

  try {
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(finalPayload);
    } else {
      await interaction.reply(finalPayload);
    }
  } catch {
    // Prevent crashes if Discord rejects the reply/followUp
  }
}

function isDisabled(entry) {
  return entry?.disabled === true || entry?.maintenance === true;
}

function getDisabledMessage(entry) {
  return (
    entry?.disabledMessage ||
    entry?.maintenanceMessage ||
    "This interaction is currently disabled or under maintenance."
  );
}

async function checkGuildOnly(interaction, entry) {
  if (!entry?.guildOnly) return true;

  if (!interaction.guild) {
    await safeReply(interaction, entry.guildOnlyMessage || "This interaction can only be used inside a server.");
    return false;
  }

  return true;
}

async function checkUserPermissions(interaction, entry) {
  const permissions = toArray(entry?.userPermissions);

  if (permissions.length === 0) return true;

  if (!interaction.guild || !interaction.memberPermissions) {
    await safeReply(interaction, "I could not check your permissions here.");
    return false;
  }

  if (!interaction.memberPermissions.has(permissions)) {
    await safeReply(
      interaction,
      entry?.userPermissionsMessage || "You do not have permission to use this interaction."
    );
    return false;
  }

  return true;
}

async function checkBotPermissions(interaction, entry) {
  const permissions = toArray(entry?.botPermissions);

  if (permissions.length === 0) return true;

  if (!interaction.guild) return true;

  const botMember = interaction.guild.members.me;

  if (!botMember) {
    await safeReply(interaction, "I could not check my permissions here.");
    return false;
  }

  const botPermissions = interaction.channel
    ? botMember.permissionsIn(interaction.channel)
    : botMember.permissions;

  if (!botPermissions.has(permissions)) {
    await safeReply(
      interaction,
      entry?.botPermissionsMessage || "I do not have the required permissions to do that."
    );
    return false;
  }

  return true;
}

async function checkCooldown(interaction, entry, fallbackName) {
  const seconds = getCooldownSeconds(entry);

  if (!seconds || seconds <= 0) return true;

  const cooldowns = getCooldowns(interaction.client);
  const cooldownId = getCooldownId(interaction, entry, fallbackName);
  const key = `interaction:${interaction.user.id}:${cooldownId}`;
  const now = Date.now();
  const expiresAt = cooldowns.get(key);

  if (expiresAt && expiresAt > now) {
    const remaining = ((expiresAt - now) / 1000).toFixed(1);
    await safeReply(
      interaction,
      entry?.cooldownMessage || `Please wait ${remaining}s before using this again.`
    );
    return false;
  }

  cooldowns.set(key, now + seconds * 1000);

  const timer = setTimeout(() => {
    if (cooldowns.get(key) <= Date.now()) {
      cooldowns.delete(key);
    }
  }, seconds * 1000);

  if (typeof timer.unref === "function") {
    timer.unref();
  }

  return true;
}

async function runChecks(interaction, entry, fallbackName) {
  if (!entry) return true;

  if (isDisabled(entry)) {
    await safeReply(interaction, getDisabledMessage(entry));
    return false;
  }

  if (!(await checkGuildOnly(interaction, entry))) return false;
  if (!(await checkUserPermissions(interaction, entry))) return false;
  if (!(await checkBotPermissions(interaction, entry))) return false;
  if (!(await checkCooldown(interaction, entry, fallbackName))) return false;

  return true;
}

async function runInteraction(interaction, label, entry, callback) {
  try {
    const allowed = await runChecks(interaction, entry, label);

    if (!allowed) return;

    await callback();
  } catch (error) {
    console.error(`${label} failed:`, error);
    await safeReply(interaction, entry?.errorMessage || DEFAULT_ERROR_MESSAGE);
  }
}

function matchesCustomId(handler, interaction) {
  if (!handler || !interaction.customId) return false;

  if (typeof handler.matches === "function") {
    return handler.matches(interaction.customId, interaction);
  }

  if (handler.customId instanceof RegExp) {
    return handler.customId.test(interaction.customId);
  }

  if (Array.isArray(handler.customId)) {
    return handler.customId.includes(interaction.customId);
  }

  if (typeof handler.customId === "string") {
    return handler.customId === interaction.customId;
  }

  if (typeof handler.customIdPrefix === "string") {
    return interaction.customId.startsWith(handler.customIdPrefix);
  }

  return false;
}

function getSelectMenuType(interaction) {
  if (interaction.isStringSelectMenu()) return "string";
  if (interaction.isUserSelectMenu()) return "user";
  if (interaction.isRoleSelectMenu()) return "role";
  if (interaction.isChannelSelectMenu()) return "channel";
  if (interaction.isMentionableSelectMenu()) return "mentionable";
  return "any";
}

function normalizeSelectType(type) {
  const value = String(type || "").toLowerCase();

  if (!value) return "any";

  if (["any", "select", "selectmenu", "select-menu", "anyselect", "anyselectmenu"].includes(value)) {
    return "any";
  }

  if (["string", "stringselect", "stringselectmenu"].includes(value)) {
    return "string";
  }

  if (["user", "userselect", "userselectmenu"].includes(value)) {
    return "user";
  }

  if (["role", "roleselect", "roleselectmenu"].includes(value)) {
    return "role";
  }

  if (["channel", "channelselect", "channelselectmenu"].includes(value)) {
    return "channel";
  }

  if (["mentionable", "mentionableselect", "mentionableselectmenu"].includes(value)) {
    return "mentionable";
  }

  return value;
}

function selectTypeMatches(handler, interaction) {
  const wantedType = getSelectMenuType(interaction);
  const handlerType = normalizeSelectType(handler?.type || handler?.selectType);

  return handlerType === "any" || handlerType === wantedType;
}

function isAnySelectMenu(interaction) {
  return (
    interaction.isStringSelectMenu() ||
    interaction.isUserSelectMenu() ||
    interaction.isRoleSelectMenu() ||
    interaction.isChannelSelectMenu() ||
    interaction.isMentionableSelectMenu()
  );
}

function findButtonHandler(interaction) {
  return interaction.client.buttonHandlers?.find((handler) => matchesCustomId(handler, interaction));
}

function findSelectMenuHandler(interaction) {
  return interaction.client.selectMenuHandlers?.find((handler) => {
    return selectTypeMatches(handler, interaction) && matchesCustomId(handler, interaction);
  });
}

function findModalHandler(interaction) {
  return interaction.client.modalHandlers?.find((handler) => matchesCustomId(handler, interaction));
}

function matchesAutocompleteHandler(handler, interaction) {
  if (!handler) return false;

  if (typeof handler.matches === "function") {
    return handler.matches(interaction);
  }

  const commandNames = toArray(handler.commandName || handler.name || handler.sourceCommand);

  return commandNames.includes(interaction.commandName);
}

async function handleAutocomplete(interaction) {
  const command = interaction.client.commands.get(interaction.commandName);

  const handler =
    interaction.client.autocompleteHandlers?.find((entry) => matchesAutocompleteHandler(entry, interaction)) ||
    command;

  if (!handler || typeof handler.execute !== "function") {
    try {
      await interaction.respond([]);
    } catch {
      // Ignore
    }
    return;
  }

  try {
    if (isDisabled(handler)) {
      await interaction.respond([]);
      return;
    }

    await handler.execute(interaction);
  } catch (error) {
    console.error(`Autocomplete ${interaction.commandName} failed:`, error);

    try {
      await interaction.respond([]);
    } catch {
      // Ignore
    }
  }
}

module.exports = {
  name: Events.InteractionCreate,

  async execute(interaction) {
    if (interaction.isAutocomplete()) {
      await handleAutocomplete(interaction);
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        await safeReply(interaction, "Unknown command.");
        return;
      }

      await runInteraction(interaction, `Command ${interaction.commandName}`, command, async () => {
        await command.execute(interaction);
      });

      return;
    }

    if (interaction.isButton()) {
      const handler = findButtonHandler(interaction);

      if (!handler) return;

      await runInteraction(interaction, `Button ${interaction.customId}`, handler, async () => {
        await handler.execute(interaction);
      });

      return;
    }

    if (isAnySelectMenu(interaction)) {
      const handler = findSelectMenuHandler(interaction);

      if (!handler) return;

      await runInteraction(interaction, `Select menu ${interaction.customId}`, handler, async () => {
        await handler.execute(interaction);
      });

      return;
    }

    if (interaction.isModalSubmit()) {
      const handler = findModalHandler(interaction);

      if (!handler) return;

      await runInteraction(interaction, `Modal ${interaction.customId}`, handler, async () => {
        await handler.execute(interaction);
      });
    }
  },
};
