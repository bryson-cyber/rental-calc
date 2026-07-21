CREATE TABLE `llc_documents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registrationId` int NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(200),
	`label` varchar(200),
	`documentType` varchar(128),
	`source` enum('provider','ops_upload') NOT NULL DEFAULT 'provider',
	`storageKey` varchar(512) NOT NULL,
	`releasedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `llc_documents_id` PRIMARY KEY(`id`),
	CONSTRAINT `llc_document_mirror_unique` UNIQUE(`registrationId`,`documentType`,`name`)
);
--> statement-breakpoint
CREATE INDEX `llc_document_registration_idx` ON `llc_documents` (`registrationId`);--> statement-breakpoint
CREATE INDEX `llc_document_user_idx` ON `llc_documents` (`userId`);