CREATE TABLE `tos_acceptances` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`userIp` varchar(45),
	`userAgent` text,
	`tosVersion` varchar(20) NOT NULL DEFAULT '1.0',
	`acceptedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tos_acceptances_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `tos_user_id_idx` ON `tos_acceptances` (`userId`);--> statement-breakpoint
CREATE INDEX `tos_session_id_idx` ON `tos_acceptances` (`sessionId`);--> statement-breakpoint
CREATE INDEX `tos_accepted_at_idx` ON `tos_acceptances` (`acceptedAt`);