CREATE TABLE `market_research_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`researchId` varchar(100) NOT NULL,
	`market` varchar(255) NOT NULL,
	`status` enum('pending','running','completed','error') NOT NULL DEFAULT 'pending',
	`progress` int DEFAULT 0,
	`currentStep` varchar(255),
	`errorMessage` text,
	`sessionId` varchar(100),
	`taskId` varchar(100),
	`result` json,
	`userId` int,
	`sessionToken` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `market_research_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `market_research_reports_researchId_unique` UNIQUE(`researchId`)
);
