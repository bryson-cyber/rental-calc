CREATE TABLE `regulation_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`locationKey` varchar(255) NOT NULL,
	`city` varchar(255) NOT NULL,
	`state` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`isApproved` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regulation_comments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_regulations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`city` varchar(255) NOT NULL,
	`state` varchar(100) NOT NULL,
	`locationKey` varchar(255) NOT NULL,
	`status` varchar(50) NOT NULL,
	`permitRequired` int DEFAULT 0,
	`primaryResidenceOnly` int DEFAULT 0,
	`registrationFee` varchar(100),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_regulations_id` PRIMARY KEY(`id`)
);
