CREATE TABLE `ai_advisor_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cacheType` enum('property','market') NOT NULL,
	`cacheKey` varchar(255) NOT NULL,
	`address` text,
	`city` varchar(255),
	`state` varchar(100),
	`zipCode` varchar(20),
	`bedrooms` int,
	`bathrooms` decimal(3,1),
	`marketName` varchar(255),
	`inputHash` varchar(64),
	`advice` text NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`hitCount` int NOT NULL DEFAULT 0,
	`lastAccessedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_advisor_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `shared_reports` MODIFY COLUMN `reportData` text;--> statement-breakpoint
ALTER TABLE `shared_reports` ADD `accommodates` int;--> statement-breakpoint
ALTER TABLE `shared_reports` ADD `submarketId` varchar(64);--> statement-breakpoint
ALTER TABLE `shared_reports` ADD `submarketName` varchar(255);--> statement-breakpoint
ALTER TABLE `shared_reports` ADD `createdByName` varchar(255);--> statement-breakpoint
ALTER TABLE `shared_reports` DROP COLUMN `passwordHash`;--> statement-breakpoint
ALTER TABLE `shared_reports` DROP COLUMN `createdBySessionId`;