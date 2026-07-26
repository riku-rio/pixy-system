# Pixy System

Discord bot system using Discord.js, Prisma 7, and MySQL.

## Requirements

- Node.js 20 or newer
- MySQL 8 or a compatible MariaDB service

## Environment variables

Copy `.env.example` to `.env` and fill in the real values:

```env
NODE_ENV=production
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
DISCORD_GUILD_ID=
PREFIX=^

# Suggestion System

OWNER_ID=
SUGGESTION_CHANNEL_ID=

# Database - MySQL

DATABASE_URL="mysql://pixy:pixy_local_password@127.0.0.1:3308/pixy_system"
```

Use `NODE_ENV=development` for local development and `NODE_ENV=production` for a deployed bot. The non-standard value `dev` is not recommended; use `development`.

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

## Production deployment

Set `NODE_ENV=production` and provide a production MySQL connection string:

```env
DATABASE_URL="mysql://USER:PASSWORD@HOST:3306/DATABASE"
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
