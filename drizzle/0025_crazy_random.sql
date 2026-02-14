CREATE TABLE `content_scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`format` varchar(20) NOT NULL,
	`topic` text NOT NULL,
	`title` varchar(500) NOT NULL,
	`hook` text NOT NULL,
	`script` text NOT NULL,
	`cta` text NOT NULL,
	`estimatedDurationSeconds` int,
	`keyDataPoints` json,
	`targetAudience` varchar(500),
	`marketDataContext` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_scripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `cs_user_idx` ON `content_scripts` (`userId`);--> statement-breakpoint
CREATE INDEX `cs_format_idx` ON `content_scripts` (`format`);--> statement-breakpoint
CREATE INDEX `cs_created_idx` ON `content_scripts` (`createdAt`);