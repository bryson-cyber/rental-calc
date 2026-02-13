CREATE TABLE `slack_report_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sentByUserId` int,
	`sentByName` varchar(255),
	`channelId` varchar(50) NOT NULL,
	`channelName` varchar(255),
	`shareCode` varchar(100) NOT NULL,
	`reportSource` varchar(20) NOT NULL,
	`address` text,
	`reportType` varchar(50),
	`dealSummary` text,
	`customMessage` text,
	`status` enum('sent','failed','pending') NOT NULL DEFAULT 'pending',
	`slackPermalink` text,
	`errorMessage` text,
	`batchId` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `slack_report_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `slack_delivery_channel_idx` ON `slack_report_deliveries` (`channelId`);--> statement-breakpoint
CREATE INDEX `slack_delivery_status_idx` ON `slack_report_deliveries` (`status`);--> statement-breakpoint
CREATE INDEX `slack_delivery_batch_idx` ON `slack_report_deliveries` (`batchId`);--> statement-breakpoint
CREATE INDEX `slack_delivery_created_idx` ON `slack_report_deliveries` (`createdAt`);