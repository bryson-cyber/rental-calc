CREATE TABLE `usage_limits_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`limitType` varchar(50) NOT NULL,
	`dailyLimit` int NOT NULL,
	`description` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `usage_limits_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `usage_limits_config_limitType_unique` UNIQUE(`limitType`)
);
--> statement-breakpoint
CREATE TABLE `user_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`ipAddress` varchar(45),
	`date` varchar(10) NOT NULL,
	`propertyAnalyses` int NOT NULL DEFAULT 0,
	`marketResearches` int NOT NULL DEFAULT 0,
	`apiCallsCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_usage_id` PRIMARY KEY(`id`)
);
