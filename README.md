# Pixy System

Discord bot built with Discord.js, Prisma 7, and MariaDB (MySQL-compatible).

## Features

- **Ticket system** — Users open private support tickets with categories (General Support, Bug Report, Other). Tickets include control panels for closing, locking, escalating, adding/removing users, and saving transcripts.
- **Suggestion system** — Administrators can submit suggestions via a modal; submissions are forwarded to the configured bot owners or a suggestion channel.
- **Bug reporting** — Admin-role members can file structured bug reports (title, description, reproduction steps, expected result) sent to the configured bot owners or a fallback channel.
- **Bilingual announcements** — Configured bot owners can compose English/Arabic announcements that are published to a chosen channel with a language toggle button.
- **Admin rules** — A bilingual (English/Arabic) admin rules reference with role-based access.
- **Learned answers** — Guild-level Q&A pairs the bot can learn and reference.

## Requirements

- Node.js 20 or newer
- MySQL 8 or a compatible MariaDB service

## Environment variables

Copy `.env.example` to `.env` and fill in the real values:

```env
NODE_ENV=production

# Discord

DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
PREFIX=!
OWNERS=123456789012345678,987654321098765432

# IDs

ADMIN_ROLE_ID=
TICKET_CATEGORY_ID=
TICKET_LOG_CHANNEL_ID=
TICKET_NOTIFICATIONS_CHANNEL_ID=
BUG_FALLBACK_CHANNEL_ID=
SUGGESTION_CHANNEL_ID=

# Database - MariaDB / MySQL

DATABASE_URL="mysql://<USERNAME>:<PASSWORD>@127.0.0.1:3308/<DATABASE_NAME>"
```

`OWNERS` accepts one or more Discord user IDs separated by commas. Every configured ID is treated equally as an owner; the first ID has no special status.

Use `NODE_ENV=development` for local development and `NODE_ENV=production` for a deployed bot. The non-standard value `dev` is not recommended; use `development`.

## Project structure

```
src/
  config/       Bootstrap, environment loader, Prisma client setup
  events/       Discord event handlers (ready, messageCreate, interactionCreate)
  prefix/       Prefix-command handlers (ticket, suggest, bug, admin-rules, enar)
prisma/
  schema.prisma            Prisma schema
  migrations/              SQLite migration history (legacy)
  mysql-migrations/        MySQL/MariaDB migration history (active)
scripts/
  clear-database.js        Destructive database-clear utility
```

## Local setup

Copy the environment template and start MySQL:

```powershell
Copy-Item .env.example .env
npm run db:up
```

The Docker Compose service publishes MySQL on host port `3308` to avoid conflicts with `pixy-mvp`, which uses ports `3306` and `3307`. Inside the container, MySQL still listens on port `3306`.

Install dependencies, generate Prisma Client, and apply migrations:

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate
```

Start the bot:

```powershell
npm start
```

Stop the local database:

```powershell
npm run db:down
```

## Clear all application data

Use the destructive database-clear command when preparing a fresh development server, replacing a test bot, resetting a deployment, or starting with an empty application database:

```powershell
npm run db:clear -- --confirm
```

The required `--confirm` flag prevents accidental execution. The command:

- Deletes rows from every application table discovered in the current database
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

## Production deployment

Set `NODE_ENV=production` and provide a production MariaDB/MySQL connection string:

```env
DATABASE_URL="mysql://<USERNAME>:<PASSWORD>@<HOST>:3306/<DATABASE_NAME>"
```

Then deploy with:

```powershell
npm install
npm run prisma:generate
npm run prisma:migrate
npm start
```

Run `prisma migrate deploy`, not `prisma migrate dev`, in production. Keep build-time dependencies available until Prisma Client generation and migration deployment finish.

The deployment migration history is stored in `prisma/mysql-migrations`. The old SQLite migrations remain only as historical files and are not referenced by `prisma.config.ts`.

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
