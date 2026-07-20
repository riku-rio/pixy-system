PRAGMA foreign_keys=OFF;

DROP TABLE IF EXISTS "TicketChannel";

CREATE TABLE "TicketChannel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guildId" TEXT NOT NULL,
    "channelId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'general',
    "name" TEXT NOT NULL,
    "claimedBy" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'medium',
    "locked" BOOLEAN NOT NULL DEFAULT false,
    "escalated" BOOLEAN NOT NULL DEFAULT false,
    "closed" BOOLEAN NOT NULL DEFAULT false,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TicketChannel_guildId_fkey" FOREIGN KEY ("guildId") REFERENCES "GuildConfig" ("guildId") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "TicketChannel_channelId_key" ON "TicketChannel"("channelId");
CREATE INDEX "TicketChannel_guildId_idx" ON "TicketChannel"("guildId");
CREATE INDEX "TicketChannel_guildId_userId_closed_idx" ON "TicketChannel"("guildId", "userId", "closed");

PRAGMA foreign_keys=ON;
