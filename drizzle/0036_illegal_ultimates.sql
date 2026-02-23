CREATE TABLE `webinar_registrants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarId` varchar(100),
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50) NOT NULL,
	`source` varchar(50) NOT NULL DEFAULT 'manual',
	`webinarName` varchar(500),
	`webinarDate` timestamp,
	`attended` int DEFAULT 0,
	`optedOut` int DEFAULT 0,
	`tags` json,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_registrants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_sms_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`messageBody` text NOT NULL,
	`templateId` int,
	`filterCriteria` json,
	`totalRecipients` int NOT NULL DEFAULT 0,
	`sentCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`campaignStatus` enum('draft','sending','completed','failed') NOT NULL DEFAULT 'draft',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `webinar_sms_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_sms_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`registrantId` int NOT NULL,
	`phone` varchar(50) NOT NULL,
	`deliveryStatus` varchar(50) NOT NULL DEFAULT 'pending',
	`externalMessageId` varchar(255),
	`error` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webinar_sms_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_sms_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`category` varchar(50) NOT NULL DEFAULT 'custom',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_sms_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `wr_phone_idx` ON `webinar_registrants` (`phone`);--> statement-breakpoint
CREATE INDEX `wr_email_idx` ON `webinar_registrants` (`email`);--> statement-breakpoint
CREATE INDEX `wr_webinar_id_idx` ON `webinar_registrants` (`webinarId`);--> statement-breakpoint
CREATE INDEX `wr_source_idx` ON `webinar_registrants` (`source`);--> statement-breakpoint
CREATE INDEX `wr_created_idx` ON `webinar_registrants` (`createdAt`);--> statement-breakpoint
CREATE INDEX `wsc_status_idx` ON `webinar_sms_campaigns` (`campaignStatus`);--> statement-breakpoint
CREATE INDEX `wsc_created_idx` ON `webinar_sms_campaigns` (`createdAt`);--> statement-breakpoint
CREATE INDEX `wsd_campaign_idx` ON `webinar_sms_deliveries` (`campaignId`);--> statement-breakpoint
CREATE INDEX `wsd_registrant_idx` ON `webinar_sms_deliveries` (`registrantId`);--> statement-breakpoint
CREATE INDEX `wsd_status_idx` ON `webinar_sms_deliveries` (`deliveryStatus`);