CREATE TABLE `activity_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`action` varchar(100) NOT NULL,
	`actionCategory` varchar(50) NOT NULL,
	`details` json,
	`ipAddress` varchar(45),
	`userAgent` text,
	`referrer` text,
	`pagePath` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_sessions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64) NOT NULL,
	`ipAddress` varchar(45),
	`userAgent` text,
	`country` varchar(100),
	`city` varchar(255),
	`pageViews` int DEFAULT 0,
	`actionsCount` int DEFAULT 0,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`lastActivityAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	CONSTRAINT `user_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_sessions_sessionId_unique` UNIQUE(`sessionId`)
);
