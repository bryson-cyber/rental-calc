CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`type` enum('report_generated','system','alert','info') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`metadata` json,
	`isRead` int NOT NULL DEFAULT 0,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owner_notification_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notificationType` enum('property_report','market_report','lead_capture','system') NOT NULL,
	`reportId` int,
	`title` varchar(255) NOT NULL,
	`summary` text,
	`triggeredByIp` varchar(45),
	`triggeredByUserId` int,
	`deliveryStatus` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`deliveredAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_notification_log_id` PRIMARY KEY(`id`)
);
