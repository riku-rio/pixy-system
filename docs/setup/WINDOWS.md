# Pixy System: Windows quick start

This guide installs and runs **Pixy System**, the standalone Discord system bot, on Windows using PowerShell and Docker Desktop.

## Prerequisites

- Git
- Node.js 20 or newer
- Docker Desktop with Docker Compose enabled
- A Discord application and bot token for Pixy System

Make sure Docker Desktop is running before starting the database.

## Clone or update

Clone into the current empty directory:

```powershell
git clone https://github.com/riku-rio/pixy-system .
```

Or update an existing clone:

```powershell
git pull origin main
```

## Configure the environment

Create the local environment files:

```powershell
Copy-Item .env.example .env
Copy-Item .env.docker.example .env.docker
```

Fill both files with the real values. The database name, username, and password in `.env` must match `.env.docker`. Pixy System publishes local MySQL on `127.0.0.1:3308`.

For local development, set `NODE_ENV=development` in `.env` and configure the Discord IDs required by the bot.

## Install and prepare the database

```powershell
npm ci
npm run db:up
npm run prisma:generate
npm run prisma:migrate
```

Pixy System currently has no database seed command.

## Start the bot

```powershell
npm start
```

`node .` is equivalent.

## Stop the local database

Stop the bot first, then run:

```powershell
npm run db:down
```

## Update an existing installation

Stop the bot, pull the latest changes, and prepare the updated application:

```powershell
git pull origin main
npm ci
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm start
```

Never commit `.env`, `.env.docker`, Discord tokens, database passwords, or other secrets.
