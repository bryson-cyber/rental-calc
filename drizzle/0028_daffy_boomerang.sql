CREATE TABLE `no_show_blasts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleId` int NOT NULL,
	`noShowCount` int NOT NULL,
	`smsSentCount` int NOT NULL,
	`smsFailedCount` int NOT NULL DEFAULT 0,
	`triggeredBy` varchar(255),
	`status` enum('in_progress','completed','failed') NOT NULL DEFAULT 'in_progress',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `no_show_blasts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `reminder_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`stage` int NOT NULL,
	`name` varchar(255) NOT NULL,
	`messageTemplate` text NOT NULL,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `reminder_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `sms_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(50) NOT NULL,
	`direction` enum('inbound','outbound') NOT NULL,
	`messageText` text NOT NULL,
	`aiProvider` varchar(50),
	`messageType` enum('welcome','reminder','no_show_blast','ai_reply','manual') NOT NULL DEFAULT 'manual',
	`externalMessageId` varchar(128),
	`deliveryStatus` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `sms_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_registrants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`scheduleId` int NOT NULL,
	`firstName` varchar(255) NOT NULL,
	`lastName` varchar(255),
	`email` varchar(320),
	`phone` varchar(50) NOT NULL,
	`phoneCountryCode` varchar(10),
	`webinarjamLeadId` varchar(64),
	`liveRoomUrl` text,
	`replayRoomUrl` text,
	`attendanceStatus` enum('registered','attended','no_show') NOT NULL DEFAULT 'registered',
	`welcomeSent` int NOT NULL DEFAULT 0,
	`noShowBlastSent` int NOT NULL DEFAULT 0,
	`lastReminderStage` int NOT NULL DEFAULT 0,
	`optedOut` int NOT NULL DEFAULT 0,
	`registeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_registrants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_schedules` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`webinarjamWebinarId` varchar(64),
	`webinarjamScheduleId` varchar(64),
	`dayOfWeek` int NOT NULL,
	`startTime` varchar(5) NOT NULL,
	`timezone` varchar(64) NOT NULL DEFAULT 'America/Los_Angeles',
	`isActive` int NOT NULL DEFAULT 1,
	`liveRoomUrl` text,
	`noShowTeaser` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_schedules_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `nsb_schedule_idx` ON `no_show_blasts` (`scheduleId`);--> statement-breakpoint
CREATE INDEX `nsb_status_idx` ON `no_show_blasts` (`status`);--> statement-breakpoint
CREATE INDEX `nsb_created_idx` ON `no_show_blasts` (`createdAt`);--> statement-breakpoint
CREATE INDEX `rt_stage_idx` ON `reminder_templates` (`stage`);--> statement-breakpoint
CREATE INDEX `rt_active_idx` ON `reminder_templates` (`isActive`);--> statement-breakpoint
CREATE INDEX `sc_phone_idx` ON `sms_conversations` (`phone`);--> statement-breakpoint
CREATE INDEX `sc_direction_idx` ON `sms_conversations` (`direction`);--> statement-breakpoint
CREATE INDEX `sc_type_idx` ON `sms_conversations` (`messageType`);--> statement-breakpoint
CREATE INDEX `sc_created_idx` ON `sms_conversations` (`createdAt`);--> statement-breakpoint
CREATE INDEX `wr_schedule_idx` ON `webinar_registrants` (`scheduleId`);--> statement-breakpoint
CREATE INDEX `wr_phone_idx` ON `webinar_registrants` (`phone`);--> statement-breakpoint
CREATE INDEX `wr_email_idx` ON `webinar_registrants` (`email`);--> statement-breakpoint
CREATE INDEX `wr_attendance_idx` ON `webinar_registrants` (`attendanceStatus`);--> statement-breakpoint
CREATE INDEX `wr_created_idx` ON `webinar_registrants` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ws_day_idx` ON `webinar_schedules` (`dayOfWeek`);--> statement-breakpoint
CREATE INDEX `ws_active_idx` ON `webinar_schedules` (`isActive`);