CREATE TABLE `email_send_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarId` varchar(64) NOT NULL,
	`registrantId` int NOT NULL DEFAULT 0,
	`recipientEmail` varchar(320) NOT NULL,
	`recipientName` text,
	`emailType` varchar(64) NOT NULL,
	`subject` text,
	`channel` varchar(32) NOT NULL DEFAULT 'gmail',
	`status` varchar(20) NOT NULL DEFAULT 'sent',
	`messageId` varchar(256),
	`errorMessage` text,
	`trackedJoinUrl` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `email_send_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_reminder_schedule` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarId` varchar(64) NOT NULL,
	`webinarName` text,
	`webinarStartTime` timestamp NOT NULL,
	`joinUrl` text,
	`enabled` int NOT NULL DEFAULT 1,
	`sendCalendarUpdates` int NOT NULL DEFAULT 1,
	`sendGmailReminders` int NOT NULL DEFAULT 1,
	`reminder24h` varchar(20) NOT NULL DEFAULT 'pending',
	`reminder24hAt` timestamp,
	`reminder24hResult` text,
	`reminder1h` varchar(20) NOT NULL DEFAULT 'pending',
	`reminder1hAt` timestamp,
	`reminder1hResult` text,
	`reminderStarting` varchar(20) NOT NULL DEFAULT 'pending',
	`reminderStartingAt` timestamp,
	`reminderStartingResult` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_reminder_schedule_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `email_log_webinar_idx` ON `email_send_log` (`webinarId`);--> statement-breakpoint
CREATE INDEX `email_log_registrant_idx` ON `email_send_log` (`registrantId`);--> statement-breakpoint
CREATE INDEX `email_log_type_idx` ON `email_send_log` (`emailType`);--> statement-breakpoint
CREATE INDEX `email_log_channel_idx` ON `email_send_log` (`channel`);--> statement-breakpoint
CREATE INDEX `email_log_status_idx` ON `email_send_log` (`status`);--> statement-breakpoint
CREATE INDEX `email_log_sent_at_idx` ON `email_send_log` (`sentAt`);--> statement-breakpoint
CREATE INDEX `reminder_schedule_webinar_idx` ON `webinar_reminder_schedule` (`webinarId`);--> statement-breakpoint
CREATE INDEX `reminder_schedule_enabled_idx` ON `webinar_reminder_schedule` (`enabled`);