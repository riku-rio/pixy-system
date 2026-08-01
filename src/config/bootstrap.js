const { Client, Collection, GatewayIntentBits, REST, Routes } = require("discord.js");
const fs = require("fs");
const path = require("path");
const { loadEnv } = require("./env");
const { prisma } = require("./prisma");

function getAllJsFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);

    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllJsFiles(fullPath, arrayOfFiles);
    } else if (file.endsWith(".js")) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function getCommandName(command) {
  return command?.data?.name || command?.name || "unknown";
}

function attachSource(handler, commandName) {
  return {
    ...handler,
    sourceCommand: commandName,
  };
}

function registerInteractionHandlers(client, command) {
  const commandName = getCommandName(command);

  for (const handler of toArray(command.buttonHandlers)) {
    client.buttonHandlers.push(attachSource(handler, commandName));
  }

  for (const handler of toArray(command.buttons)) {
    client.buttonHandlers.push(attachSource(handler, commandName));
  }

  for (const handler of toArray(command.selectMenuHandlers)) {
    client.selectMenuHandlers.push(attachSource(handler, commandName));
  }

  for (const handler of toArray(command.selectMenus)) {
    client.selectMenuHandlers.push(attachSource(handler, commandName));
  }

  for (const handler of toArray(command.modalHandlers)) {
    client.modalHandlers.push(attachSource(handler, commandName));
  }

  for (const handler of toArray(command.modals)) {
    client.modalHandlers.push(attachSource(handler, commandName));
  }

  if (typeof command.autocomplete === "function") {
    client.autocompleteHandlers.push({
      sourceCommand: commandName,
      commandName,
      execute: command.autocomplete,
    });
  }

  for (const handler of toArray(command.autocompleteHandlers)) {
    client.autocompleteHandlers.push(attachSource(handler, commandName));
  }

  for (const handler of toArray(command.componentHandlers)) {
    const type = String(handler.type || "").toLowerCase();
    const preparedHandler = attachSource(handler, commandName);

    if (type === "button" || type === "buttons") {
      client.buttonHandlers.push(preparedHandler);
    } else if (type === "modal" || type === "modals") {
      client.modalHandlers.push(preparedHandler);
    } else if (type === "autocomplete") {
      client.autocompleteHandlers.push(preparedHandler);
    } else {
      client.selectMenuHandlers.push(preparedHandler);
    }
  }
}

function commandToJSON(command) {
  if (typeof command.data?.toJSON === "function") {
    return command.data.toJSON();
  }

  return command.data;
}

async function syncCommands({ token, clientId, guildId }, commands, prefixCount) {
  const rest = new REST({ version: "10" }).setToken(token);
  const body = commands.map(commandToJSON);

  if (guildId) {
    await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
    console.log(`Synced ${body.length} guild slash command(s) to ${guildId}.`);
    console.log(`Loaded ${prefixCount} prefix command(s).`);
    return;
  }

  await rest.put(Routes.applicationCommands(clientId), { body });
  console.log(`Synced ${body.length} global slash command(s).`);
  console.log(`Loaded ${prefixCount} prefix command(s).`);
}

function registerShutdownHandlers(client) {
  let shuttingDown = false;

  const shutdown = async (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;

    console.log(`Received ${signal}; shutting down cleanly.`);

    const forceExitTimer = setTimeout(() => {
      console.error("Graceful shutdown timed out; forcing exit.");
      process.exit(1);
    }, 25000);
    forceExitTimer.unref();

    try {
      client.destroy();
      await prisma.$disconnect();
      clearTimeout(forceExitTimer);
      process.exit(0);
    } catch (error) {
      console.error("Graceful shutdown failed:", error);
      clearTimeout(forceExitTimer);
      process.exit(1);
    }
  };

  process.once("SIGINT", () => void shutdown("SIGINT"));
  process.once("SIGTERM", () => void shutdown("SIGTERM"));
}

async function bootstrap() {
  try {
    const env = loadEnv();

    const client = new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
      ],
    });

    registerShutdownHandlers(client);
    client.appEnv = env;

    client.commands = new Collection();

    client.prefixCommands = new Collection();
    client.aliases = new Collection();

    client.buttonHandlers = [];
    client.selectMenuHandlers = [];
    client.modalHandlers = [];
    client.autocompleteHandlers = [];

    client.cooldowns = new Collection();

    const prefixPath = path.join(__dirname, "../prefix");

    if (fs.existsSync(prefixPath)) {
      const prefixCommandFiles = getAllJsFiles(prefixPath);

      for (const file of prefixCommandFiles) {
        const command = require(file);

        if (!command?.name || typeof command.execute !== "function") {
          console.warn(`Skipped invalid prefix command: ${file}`);
          continue;
        }

        const commandName = command.name.toLowerCase();
        client.prefixCommands.set(commandName, command);

        if (Array.isArray(command.aliases)) {
          for (const alias of command.aliases) {
            client.aliases.set(String(alias).toLowerCase(), commandName);
          }
        }

        registerInteractionHandlers(client, command);
      }
    }

    const slashPath = path.join(__dirname, "../slash");
    const commands = [];

    if (fs.existsSync(slashPath)) {
      const slashCommandFiles = getAllJsFiles(slashPath);

      for (const file of slashCommandFiles) {
        const command = require(file);

        if (!command?.data || typeof command.execute !== "function") {
          console.warn(`Skipped invalid slash command: ${file}`);
          continue;
        }

        const commandName = getCommandName(command);

        commands.push(command);
        client.commands.set(commandName, command);

        registerInteractionHandlers(client, command);
      }
    }

    const eventsPath = path.join(__dirname, "../events");

    if (fs.existsSync(eventsPath)) {
      const eventFiles = getAllJsFiles(eventsPath);

      for (const file of eventFiles) {
        const event = require(file);

        if (!event?.name || typeof event.execute !== "function") {
          console.warn(`Skipped invalid event: ${file}`);
          continue;
        }

        if (event.once || event.name === "ready") {
          client.once(event.name, (...args) => event.execute(...args));
        } else {
          client.on(event.name, (...args) => event.execute(...args));
        }
      }
    }

    await syncCommands(env, commands, client.prefixCommands.size);
    await client.login(env.token);
  } catch (error) {
    console.error("Startup failed:", error);
    try {
      await prisma.$disconnect();
    } catch (disconnectError) {
      console.error("Failed to disconnect Prisma after startup failure:", disconnectError);
    }
    process.exit(1);
  }
}

module.exports = {
  bootstrap,
};
