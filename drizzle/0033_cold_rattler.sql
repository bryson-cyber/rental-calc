CREATE TABLE `suppression_contacts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`phone` varchar(50),
	`email` varchar(320),
	`firstName` varchar(255),
	`lastName` varchar(255),
	`tag` enum('buyer','past_attendee','past_noshow','dnc') NOT NULL,
	`source` enum('hubspot_import','webinarjam_sync','manual','csv_import') NOT NULL,
	`hubspotRecordId` varchar(50),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `suppression_contacts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `suppression_phone_idx` ON `suppression_contacts` (`phone`);--> statement-breakpoint
CREATE INDEX `suppression_email_idx` ON `suppression_contacts` (`email`);--> statement-breakpoint
CREATE INDEX `suppression_tag_idx` ON `suppression_contacts` (`tag`);--> statement-breakpoint
CREATE INDEX `suppression_phone_tag_idx` ON `suppression_contacts` (`phone`,`tag`);