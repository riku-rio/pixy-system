-- CreateTable
CREATE TABLE "GuildConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "ticketCategoryId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "maxLearnedItems" INTEGER NOT NULL DEFAULT 20,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LearnedAnswer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "LearnedAnswer_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TicketChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TicketChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "GuildConfig_guildId_key" ON "GuildConfig"("guildId");

-- CreateIndex
CREATE INDEX "LearnedAnswer_guildId_idx" ON "LearnedAnswer"("guildId");

-- CreateIndex
CREATE UNIQUE INDEX "TicketChannel_channelId_key" ON "TicketChannel"("channelId");

-- CreateIndex
CREATE INDEX "TicketChannel_guildId_idx" ON "TicketChannel"("guildId");
