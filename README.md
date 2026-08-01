# Pixy System

Discord bot built with Discord.js, Prisma 7, and MySQL/MariaDB.

## Features

- **Ticket system** — Users open private support tickets with categories (General Support, Bug Report, Other). Tickets include control panels for closing, locking, escalating, adding/removing users, and saving transcripts.
- **Suggestion system** — Administrators can submit suggestions through a modal; submissions are forwarded to the bot owner or a configured suggestion channel.
- **Bug reporting** — Admin-role members can file structured bug reports sent to the bot owner or a fallback channel.
- **Bilingual announcements** — The bot owner can publish English/Arabic announcements with a language toggle.
- **Admin rules** — A bilingual English/Arabic admin-rules reference with role-based access.
- **Learned answers** — Guild-level Q&A pairs the bot can learn and reference.

## Requirements

- Node.js 20 or newer
- MySQL 8 or a compatible MariaDB service

## Environment variables

Copy `.env.example` to `.env` for local use and fill in the real values. Production uses a protected environment file outside the repository.

```env
NODE_ENV=production
BOT_INSTANCE_NAME=pixy-system

DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
PREFIX=!
OWNER_ID=

ADMIN_ROLE_ID=
TICKET_CATEGORY_ID=
TICKET_LOG_CHANNEL_ID=
TICKET_NOTIFICATIONS_CHANNEL_ID=
BUG_FALLBACK_CHANNEL_ID=
SUGGESTION_CHANNEL_ID=

DATABASE_URL="mysql://pixy_system_app:STRONG_PASSWORD@127.0.0.1:3306/pixy_system?connection_limit=5"
```

Use a dedicated database and user for this application. Never use the MySQL root account in `DATABASE_URL`.

## Project structure

```text
src/
  config/       Bootstrap, environment loader, Prisma client setup
  events/       Discord event handlers
  prefix/       Prefix-command handlers
prisma/
  schema.prisma
  mysql-migrations/
scripts/
  clear-database.js
deploy/vps/
  compose.yml                       Shared production MySQL instance
  Initialize-SharedMySql.ps1        Database/user initializer
  Invoke-DatabaseMigration.ps1      Protected migration helper
  Backup-SharedMySql.ps1            Logical backup helper
  pixy-system.service.example       systemd service template
```

## Local development

The root `docker-compose.yml` is intentionally development-only. It binds MySQL to localhost and reads credentials from the ignored `.env.docker` file.

```powershell
Copy-Item .env.example .env
Copy-Item .env.docker.example .env.docker
```

Replace the placeholder values in both files. The local database is published on `127.0.0.1:3308`, so use a matching local connection string:

```env
DATABASE_URL="mysql://pixy_system:YOUR_DEVELOPMENT_PASSWORD@127.0.0.1:3308/pixy_system"
```

Start MySQL, install dependencies, generate Prisma Client, and apply migrations:

```powershell
npm run db:up
npm install
npm run prisma:generate
npm run prisma:migrate
```

Start the bot:

```powershell
npm start
```

View or stop the local database:

```powershell
npm run db:logs
npm run db:down
```

## Production VPS deployment

Production should not use the root development Compose file or its passwords. The recommended layout is:

```text
VPS
├── pixy-system Node.js service
├── pixy Node.js service
└── one MySQL 8 instance
    ├── pixy_system database + dedicated user
    └── pixy database + dedicated user
```

The production MySQL compose stack binds port 3306 only to `127.0.0.1`, stores its root password through a Compose secret, and gives this bot a least-privilege database account. The bot is supervised by systemd and shuts down Discord/Prisma cleanly on `SIGTERM`.

Follow [docs/PRODUCTION_VPS.md](docs/PRODUCTION_VPS.md) for the complete PowerShell deployment, migration, update, and backup procedure.

## Clear all application data

Use the destructive database-clear command when preparing a fresh development server or intentionally resetting a deployment:

```powershell
npm run db:clear -- --confirm
```

The command deletes rows from application tables, handles foreign keys, resets auto-increment counters, and preserves the schema and Prisma migration history. Stop the bot before running it. This operation cannot be undone without a backup.

Running it without confirmation stops safely:

```powershell
npm run db:clear
```

## Production migration commands

Generate Prisma Client and deploy committed migrations:

```powershell
npm run prisma:generate
npm run prisma:migrate
```

Use `prisma migrate deploy` through `npm run prisma:migrate` in production. Use `npm run prisma:migrate:dev` only while developing schema changes locally.

## Useful npm commands

```powershell
npm start
npm run db:up
npm run db:logs
npm run db:down
npm run db:clear -- --confirm
npm run prisma:generate
npm run prisma:migrate
npm run prisma:migrate:dev
```
