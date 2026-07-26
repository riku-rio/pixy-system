# Pixy System

Discord bot system using Discord.js, Prisma 7, and MySQL.

## Requirements

- Node.js 20 or newer
- MySQL 8 or a compatible MariaDB service

## Local setup

Copy `.env.example` to `.env`, then start MySQL:

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

## Production deployment

Set `DATABASE_URL` to a production MySQL connection string:

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
