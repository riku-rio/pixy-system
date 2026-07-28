# Pixy System

Discord bot system using Discord.js, Prisma 7, and MySQL.

## Requirements

- Node.js 22 or 24
- MySQL 8 or a compatible MariaDB service

## One codebase, isolated environments

Production and testing use the same repository and code. Each bot instance must have its own environment configuration, Discord application, Discord server resources, and database.

Do not copy the production `.env` into testing without replacing every instance-specific value. A testing bot must not use the production token, client ID, guild ID, role IDs, channel IDs, or database URL.

## Environment variables

Copy `.env.example` to `.env` and fill in the values for the current bot instance:

```env
# Runtime
NODE_ENV=development
BOT_INSTANCE_NAME=pixy-system-testing
PORT=3000

# Discord application and server
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
PREFIX=^
OWNER_ID=

# Server-specific roles and channels
ADMIN_ROLE_ID=
TICKET_CATEGORY_ID=
TICKET_LOG_CHANNEL_ID=
TICKET_NOTIFICATIONS_CHANNEL_ID=
BUG_FALLBACK_CHANNEL_ID=
SUGGESTION_CHANNEL_ID=

# Database
DATABASE_URL="mysql://USER:PASSWORD@127.0.0.1:3308/DATABASE_NAME"
```

All Discord IDs are required and validated during startup. The bot stops immediately when a required value is missing or is not a valid Discord snowflake.

The configured resources are used as follows:

- `DISCORD_GUILD_ID`: server where guild commands are synchronized
- `OWNER_ID`: only user allowed to invoke prefix commands
- `ADMIN_ROLE_ID`: role allowed to manage tickets, submit bug reports, and view private admin content
- `TICKET_CATEGORY_ID`: parent category for newly created ticket channels
- `TICKET_LOG_CHANNEL_ID`: destination for ticket transcripts
- `TICKET_NOTIFICATIONS_CHANNEL_ID`: destination for escalation notifications
- `BUG_FALLBACK_CHANNEL_ID`: fallback when the owner cannot receive a bug report by DM
- `SUGGESTION_CHANNEL_ID`: fallback when the owner cannot receive a suggestion by DM
- `BOT_INSTANCE_NAME`: identifies the instance in health responses and runtime logs

## Local testing setup

Create a dedicated Discord testing application and testing server, then create a dedicated local `.env`:

```powershell
Copy-Item .env.example .env
```

Start MySQL:

```powershell
npm run db:up
```

The Docker Compose service publishes MySQL on host port `3308`. Inside the container, MySQL listens on port `3306`.

Install dependencies, generate Prisma Client, and apply migrations:

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate
```

Start the testing bot:

```powershell
npm start
```

Stop the local database:

```powershell
npm run db:down
```

## Production deployment

Create a separate Hostinger environment for the production bot and set the same environment keys with production-specific values. The production database must be separate from the testing database.

Example production database URL:

```env
DATABASE_URL="mysql://USER:PASSWORD@localhost:3306/DATABASE_NAME"
```

Deploy with:

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate
npm start
```

Run `prisma migrate deploy`, not `prisma migrate dev`, in production. Keep build-time dependencies available until Prisma Client generation and migration deployment finish.

The deployment migration history is stored in `prisma/mysql-migrations`. The old SQLite migrations remain only as historical files and are not referenced by `prisma.config.ts`.

## Clear all application data

Use the destructive database-clear command when preparing a fresh development server, replacing a test bot, resetting a deployment, or starting with an empty application database:

```powershell
npm run db:clear -- --confirm
```

The required `--confirm` flag prevents accidental execution. The command:

- Deletes rows from every application table discovered in the current MySQL database
- Handles foreign-key relationships safely
- Resets auto-increment counters where applicable
- Preserves the database schema
- Preserves Prisma's `_prisma_migrations` table and migration history
- Automatically includes application tables added by future Prisma models

This operation is destructive and cannot be undone without a backup. Stop the bot before clearing the database so it cannot write new records during the reset.

Running the command without confirmation stops safely:

```powershell
npm run db:clear
```

## Useful npm commands

```powershell
npm start
npm run db:up
npm run db:down
npm run db:clear -- --confirm
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:dev
```

Use `npm run prisma:migrate:dev` only during local schema development. Use `npm run prisma:migrate` for deployed environments.
