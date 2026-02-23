CREATE TABLE `webinar_transcripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarId` varchar(100) NOT NULL,
	`webinarTitle` varchar(500),
	`keySummary` text,
	`transcript` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_transcripts_id` PRIMARY KEY(`id`),
	CONSTRAINT `webinar_transcripts_webinarId_unique` UNIQUE(`webinarId`)
);
