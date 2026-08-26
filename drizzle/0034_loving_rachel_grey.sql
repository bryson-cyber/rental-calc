CREATE TABLE `llc_required_actions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registrationId` int NOT NULL,
	`requiredActionId` varchar(160) NOT NULL,
	`doolaCompanyId` varchar(64) NOT NULL,
	`actionCode` varchar(96) NOT NULL,
	`actionName` varchar(200) NOT NULL,
	`reason` text NOT NULL,
	`status` varchar(32) NOT NULL,
	`open` boolean NOT NULL DEFAULT true,
	`source` varchar(32) NOT NULL DEFAULT 'reconciliation',
	`providerUpdatedAt` timestamp,
	`history` json,
	`submittedPayload` json,
	`clientNotifiedAt` timestamp,
	`opsNotifiedAt` timestamp,
	`resolvedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `llc_required_actions_id` PRIMARY KEY(`id`),
	CONSTRAINT `llc_required_action_provider_unique` UNIQUE(`requiredActionId`)
);
--> statement-breakpoint
CREATE INDEX `llc_required_action_registration_idx` ON `llc_required_actions` (`registrationId`);--> statement-breakpoint
CREATE INDEX `llc_required_action_open_idx` ON `llc_required_actions` (`open`,`registrationId`);--> statement-breakpoint
CREATE INDEX `llc_required_action_company_idx` ON `llc_required_actions` (`doolaCompanyId`);
