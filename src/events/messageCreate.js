const { Events, Collection } = require("discord.js");

const DEFAULT_ERROR_MESSAGE = "There was an error trying to execute that command!";

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

function isDisabled(command) {
  return command?.disabled === true || command?.maintenance === true;
}

function getDisabledMessage(command) {
  return (
    command?.disabledMessage ||
    command?.maintenanceMessage ||
    "This command is currently disabled or under maintenance."
  );
}

function getPrefixData(message) {
  const prefix = message.client.appEnv?.prefix || "!";
  const botId = message.client.user?.id;

  if (botId) {
    const mentionRegex = new RegExp(`^<@!?${botId}>\\s*`);
    const mentionMatch = message.content.match(mentionRegex);

    if (mentionMatch) {
      return {
        matched: true,
        prefix: mentionMatch[0],
        rawPrefix: prefix,
        usedMentionPrefix: true,
      };
    }
  }

  if (message.content.startsWith(prefix)) {
    return {
      matched: true,
      prefix,
      rawPrefix: prefix,
      usedMentionPrefix: false,
    };
  }

  return {
    matched: false,
    prefix,
    rawPrefix: prefix,
    usedMentionPrefix: false,
  };
}

function getCommandUsage(command, prefix) {
  if (command?.usage) {
    return `${prefix}${command.usage}`;
  }

  if (command?.name) {
    return `${prefix}${command.name}`;
  }

  return null;
}

function isBotOwner(message) {
  return message.client.appEnv?.owners?.has(message.author.id) === true;
}

async function checkGuildOnly(message, command) {
  if (!command?.guildOnly) return true;

  if (!message.guild) {
    await message.reply(command.guildOnlyMessage || "This command can only be used inside a server.");
    return false;
  }

  return true;
}

async function checkUserPermissions(message, command) {
  if (isBotOwner(message)) return true;

  const permissions = toArray(command?.userPermissions);

  if (permissions.length === 0) return true;

  if (!message.guild || !message.member) {
    await message.reply("I could not check your permissions here.");
    return false;
  }

  if (!message.member.permissions.has(permissions)) {
    await message.reply(command.userPermissionsMessage || "You do not have permission to use this command.");
    return false;
  }

  return true;
}

async function checkBotPermissions(message, command) {
  const permissions = toArray(command?.botPermissions);

  if (permissions.length === 0) return true;

  if (!message.guild) return true;

  const botMember = message.guild.members.me;

  if (!botMember) {
    await message.reply("I could not check my permissions here.");
    return false;
  }

  const botPermissions = botMember.permissionsIn(message.channel);

  if (!botPermissions.has(permissions)) {
    await message.reply(command.botPermissionsMessage || "I do not have the required permissions to do that.");
    return false;
  }

  return true;
}

async function checkArgs(message, command, args, prefix) {
  const minArgs = Number(command?.minArgs || 0);
  const maxArgs = command?.maxArgs === undefined ? null : Number(command.maxArgs);

  if (command?.argsRequired && args.length === 0) {
    const usage = getCommandUsage(command, prefix);
    await message.reply(usage ? `Usage: \`${usage}\`` : "This command requires arguments.");
    return false;
  }

  if (minArgs > 0 && args.length < minArgs) {
    const usage = getCommandUsage(command, prefix);
    await message.reply(usage ? `Usage: \`${usage}\`` : `This command requires at least ${minArgs} argument(s).`);
    return false;
  }

  if (maxArgs !== null && args.length > maxArgs) {
    const usage = getCommandUsage(command, prefix);
    await message.reply(usage ? `Usage: \`${usage}\`` : `This command accepts at most ${maxArgs} argument(s).`);
    return false;
  }

  return true;
}

async function checkCooldown(message, command) {
  const seconds = Number(command?.cooldown || command?.cooldownSeconds || 0);

  if (!seconds || seconds <= 0) return true;

  const cooldowns = getCooldowns(message.client);
  const cooldownId = command.cooldownId || command.name;
  const key = `prefix:${message.author.id}:${cooldownId}`;
  const now = Date.now();
  const expiresAt = cooldowns.get(key);

  if (expiresAt && expiresAt > now) {
    const remaining = ((expiresAt - now) / 1000).toFixed(1);
    await message.reply(command.cooldownMessage || `Please wait ${remaining}s before using this command again.`);
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

async function runChecks(message, command, args, prefix) {
  if (isDisabled(command)) {
    await message.reply(getDisabledMessage(command));
    return false;
  }

  if (!(await checkGuildOnly(message, command))) return false;
  if (!(await checkUserPermissions(message, command))) return false;
  if (!(await checkBotPermissions(message, command))) return false;
  if (!(await checkArgs(message, command, args, prefix))) return false;
  if (!(await checkCooldown(message, command))) return false;

  return true;
}

module.exports = {
  name: Events.MessageCreate,

  async execute(message) {
    if (message.author.bot) return;
    if (message.webhookId) return;

    const prefixData = getPrefixData(message);

    if (!prefixData.matched) return;

    const content = message.content.slice(prefixData.prefix.length).trim();

    if (!content) {
      if (prefixData.usedMentionPrefix) {
        await message.reply(`My prefix is \`${prefixData.rawPrefix}\`.`);
      }

      return;
    }

    const args = content.split(/ +/);
    const commandName = args.shift()?.toLowerCase();

    if (!commandName) return;

    const command =
      message.client.prefixCommands.get(commandName) ||
      message.client.prefixCommands.get(message.client.aliases.get(commandName));

    if (!command) return;
    if (!isBotOwner(message)) return;

    try {
      const allowed = await runChecks(message, command, args, prefixData.rawPrefix);

      if (!allowed) return;

      await command.execute(message, args);
    } catch (error) {
      console.error(`Prefix command ${commandName} failed:`, error);
      await message.reply(command.errorMessage || DEFAULT_ERROR_MESSAGE);
    }
  },
};
