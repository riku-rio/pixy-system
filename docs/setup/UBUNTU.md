# Pixy System: Ubuntu quick start

This guide installs and runs **Pixy System**, the standalone Discord system bot, on Ubuntu using Docker Engine and the Docker Compose plugin.

## Prerequisites

Use Ubuntu 22.04 or newer with:

- Git
- Node.js 20 or newer
- Docker Engine
- Docker Compose plugin
- A Discord application and bot token for Pixy System

Confirm the tools are available:

```bash
git --version
node --version
npm --version
docker --version
docker compose version
```

Start Docker and enable it at boot:

```bash
sudo systemctl enable --now docker
```

To use Docker without `sudo`, add the current user to the Docker group, then sign out and back in:

```bash
sudo usermod -aG docker "$USER"
```

## Clone or update

Clone into the current empty directory:

```bash
git clone https://github.com/riku-rio/pixy-system .
```

Or update an existing clone:

```bash
git pull origin main
```

## Configure the environment

Create the local environment files:

```bash
cp .env.example .env
cp .env.docker.example .env.docker
```

Fill both files with the real values. The database name, username, and password in `.env` must match `.env.docker`. Pixy System publishes local MySQL on `127.0.0.1:3308`.

For local development, set `NODE_ENV=development` in `.env` and configure the Discord IDs required by the bot.

## Install and prepare the database

```bash
npm ci
npm run db:up
npm run prisma:generate
npm run prisma:migrate
```

Pixy System currently has no database seed command.

## Start the bot

```bash
npm start
```

`node .` is equivalent.

## Stop the local database

Stop the bot first, then run:

```bash
npm run db:down
```

## Update an existing installation

Stop the bot, pull the latest changes, and prepare the updated application:

```bash
git pull origin main
npm ci
npm run db:up
npm run prisma:generate
npm run prisma:migrate
npm start
```

Never commit `.env`, `.env.docker`, Discord tokens, database passwords, or other secrets.
