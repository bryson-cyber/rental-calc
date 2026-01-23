CREATE TABLE `market_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`email` varchar(320) NOT NULL,
	`marketId` varchar(64) NOT NULL,
	`marketName` varchar(255) NOT NULL,
	`alertType` enum('revenue_change','occupancy_change','adr_change','all_changes') NOT NULL DEFAULT 'all_changes',
	`thresholdPercent` int NOT NULL DEFAULT 10,
	`baselineRevenue` int,
	`baselineOccupancy` decimal(5,2),
	`baselineAdr` int,
	`isActive` enum('true','false') NOT NULL DEFAULT 'true',
	`lastCheckedAt` timestamp,
	`lastAlertSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `market_alerts_id` PRIMARY KEY(`id`)
);
