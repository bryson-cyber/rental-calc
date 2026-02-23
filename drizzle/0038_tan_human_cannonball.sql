CREATE TABLE `scheduled_sms_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarId` varchar(100) NOT NULL,
	`sequenceName` varchar(255) NOT NULL,
	`sequenceOrder` int NOT NULL,
	`messageBody` text NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`status` enum('pending','sending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
	`audience` enum('all','attended','not_attended') NOT NULL DEFAULT 'all',
	`sentCount` int DEFAULT 0,
	`failedCount` int DEFAULT 0,
	`sentAt` timestamp,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_sms_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ssm_webinar_idx` ON `scheduled_sms_messages` (`webinarId`);--> statement-breakpoint
CREATE INDEX `ssm_status_idx` ON `scheduled_sms_messages` (`status`);--> statement-breakpoint
CREATE INDEX `ssm_scheduled_at_idx` ON `scheduled_sms_messages` (`scheduledAt`);--> statement-breakpoint
CREATE INDEX `ssm_sequence_order_idx` ON `scheduled_sms_messages` (`sequenceOrder`);