CREATE TABLE `promo_drip_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`status` enum('draft','active','completed','cancelled') NOT NULL DEFAULT 'draft',
	`hubspotListId` varchar(50) NOT NULL,
	`hubspotListName` varchar(255),
	`snapshotAt` timestamp,
	`snapshotTotal` int NOT NULL DEFAULT 0,
	`eligibleCount` int NOT NULL DEFAULT 0,
	`excludedWebinarCount` int NOT NULL DEFAULT 0,
	`smsEligibleCount` int NOT NULL DEFAULT 0,
	`launchedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promo_drip_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promo_drip_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`channel` enum('email','sms') NOT NULL,
	`stepKey` varchar(50) NOT NULL,
	`sequenceOrder` int NOT NULL,
	`dayOffset` int NOT NULL,
	`sendTimeEt` varchar(5) NOT NULL DEFAULT '09:00',
	`subject` varchar(500),
	`body` text NOT NULL,
	`scheduledAt` timestamp,
	`status` enum('pending','sending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
	`sentCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`skippedCount` int NOT NULL DEFAULT 0,
	`error` text,
	`claimedAt` timestamp,
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promo_drip_messages_id` PRIMARY KEY(`id`),
	CONSTRAINT `pdm_step_uq` UNIQUE(`campaignId`,`stepKey`)
);
--> statement-breakpoint
CREATE TABLE `promo_drip_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`hubspotContactId` varchar(50) NOT NULL,
	`email` varchar(320),
	`firstName` varchar(255),
	`phone` varchar(50) NOT NULL DEFAULT '',
	`phoneValid` int NOT NULL DEFAULT 0,
	`excludedAt` timestamp,
	`excludedReason` varchar(100),
	`unsubscribedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promo_drip_recipients_id` PRIMARY KEY(`id`),
	CONSTRAINT `pdr_contact_uq` UNIQUE(`campaignId`,`hubspotContactId`)
);
--> statement-breakpoint
CREATE TABLE `promo_drip_send_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`messageId` int NOT NULL,
	`recipientId` int NOT NULL,
	`channel` varchar(10) NOT NULL,
	`status` varchar(20) NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`externalId` varchar(255),
	`sentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promo_drip_send_log_id` PRIMARY KEY(`id`),
	CONSTRAINT `promo_send_claim_uq` UNIQUE(`messageId`,`recipientId`)
);
--> statement-breakpoint
ALTER TABLE `llc_registrations` ADD `doolaEnv` varchar(16);--> statement-breakpoint
ALTER TABLE `llc_state_pricing` ADD `expediteEinPriceCents` int;--> statement-breakpoint
CREATE INDEX `pdc_status_idx` ON `promo_drip_campaigns` (`status`);--> statement-breakpoint
CREATE INDEX `pdm_status_sched_idx` ON `promo_drip_messages` (`status`,`scheduledAt`);--> statement-breakpoint
CREATE INDEX `pdm_campaign_idx` ON `promo_drip_messages` (`campaignId`);--> statement-breakpoint
CREATE INDEX `pdr_campaign_idx` ON `promo_drip_recipients` (`campaignId`);--> statement-breakpoint
CREATE INDEX `pdr_email_idx` ON `promo_drip_recipients` (`email`);--> statement-breakpoint
CREATE INDEX `pdr_phone_idx` ON `promo_drip_recipients` (`phone`);--> statement-breakpoint
CREATE INDEX `pdsl_campaign_idx` ON `promo_drip_send_log` (`campaignId`);--> statement-breakpoint
CREATE INDEX `pdsl_message_status_idx` ON `promo_drip_send_log` (`messageId`,`status`);