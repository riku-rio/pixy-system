CREATE TABLE `GuildConfig` (
  `id` VARCHAR(191) NOT NULL,
  `guildId` VARCHAR(32) NOT NULL,
  `ticketCategoryId` VARCHAR(32) NULL,
  `enabled` BOOLEAN NOT NULL DEFAULT true,
  `maxLearnedItems` INTEGER NOT NULL DEFAULT 20,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `GuildConfig_guildId_key`(`guildId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `LearnedAnswer` (
  `id` VARCHAR(191) NOT NULL,
  `guildId` VARCHAR(32) NOT NULL,
  `question` TEXT NOT NULL,
  `answer` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  INDEX `LearnedAnswer_guildId_idx`(`guildId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `LearnedAnswer_guildId_fkey`
    FOREIGN KEY (`guildId`) REFERENCES `GuildConfig`(`guildId`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `TicketChannel` (
  `id` VARCHAR(191) NOT NULL,
  `guildId` VARCHAR(32) NOT NULL,
  `channelId` VARCHAR(32) NOT NULL,
  `userId` VARCHAR(32) NOT NULL,
  `category` VARCHAR(32) NOT NULL DEFAULT 'general',
  `name` VARCHAR(100) NOT NULL,
  `claimedBy` VARCHAR(32) NULL,
  `priority` VARCHAR(16) NOT NULL DEFAULT 'medium',
  `locked` BOOLEAN NOT NULL DEFAULT false,
  `escalated` BOOLEAN NOT NULL DEFAULT false,
  `closed` BOOLEAN NOT NULL DEFAULT false,
  `openedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `closedAt` DATETIME(3) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `TicketChannel_channelId_key`(`channelId`),
  INDEX `TicketChannel_guildId_idx`(`guildId`),
  INDEX `TicketChannel_guildId_userId_closed_idx`(`guildId`, `userId`, `closed`),
  PRIMARY KEY (`id`),
  CONSTRAINT `TicketChannel_guildId_fkey`
    FOREIGN KEY (`guildId`) REFERENCES `GuildConfig`(`guildId`)
    ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
