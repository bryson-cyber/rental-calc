CREATE TABLE `webinar_credentials` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarId` varchar(100) NOT NULL,
	`webinarName` varchar(500),
	`apiKey` text,
	`webinarHash` varchar(100),
	`memberId` varchar(100),
	`integrationWebinarId` varchar(100),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_credentials_id` PRIMARY KEY(`id`),
	CONSTRAINT `webinar_credentials_webinarId_unique` UNIQUE(`webinarId`)
);
