CREATE TABLE `BilingualAnnouncement` (
  `id` VARCHAR(191) NOT NULL,
  `messageId` VARCHAR(32) NULL,
  `guildId` VARCHAR(32) NOT NULL,
  `channelId` VARCHAR(32) NOT NULL,
  `createdBy` VARCHAR(32) NOT NULL,
  `title` VARCHAR(256) NULL,
  `footer` TEXT NULL,
  `englishText` TEXT NOT NULL,
  `arabicText` TEXT NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `BilingualAnnouncement_messageId_key`(`messageId`),
  INDEX `BilingualAnnouncement_guildId_channelId_idx`(`guildId`, `channelId`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
