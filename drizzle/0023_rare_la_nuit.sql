CREATE TABLE `llc_founders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registrationId` int NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`isPrimary` boolean NOT NULL DEFAULT false,
	`firstName` varchar(100),
	`lastName` varchar(100),
	`email` varchar(320),
	`phone` varchar(32),
	`ssnEncrypted` varchar(512),
	`ownershipBasisPoints` int,
	`addressLine1` varchar(255),
	`addressLine2` varchar(255),
	`addressCity` varchar(120),
	`addressState` varchar(64),
	`addressPostalCode` varchar(24),
	`addressCountry` varchar(2) NOT NULL DEFAULT 'US',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `llc_founders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `llc_registrations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('draft','ready','submitting','payment_required','processing','completed','action_required','failed') NOT NULL DEFAULT 'draft',
	`currentStep` int NOT NULL DEFAULT 1,
	`legalName` varchar(160),
	`entitySuffix` enum('LLC','L.L.C','L.L.C.','Limited Liability Company') NOT NULL DEFAULT 'LLC',
	`formationState` varchar(2),
	`businessType` varchar(128),
	`industryGroup` varchar(128),
	`industryType` varchar(128),
	`businessPhone` varchar(32),
	`website` text,
	`useRegisteredAgent` boolean NOT NULL DEFAULT false,
	`companyAddressLine1` varchar(255),
	`companyAddressLine2` varchar(255),
	`companyAddressCity` varchar(120),
	`companyAddressState` varchar(64),
	`companyAddressPostalCode` varchar(24),
	`companyAddressCountry` varchar(2) NOT NULL DEFAULT 'US',
	`expediteEin` boolean NOT NULL DEFAULT false,
	`accuracyAttested` boolean NOT NULL DEFAULT false,
	`whopAccountId` varchar(64),
	`accountEmailAlias` varchar(320),
	`checkoutSessionId` varchar(64),
	`checkoutUrl` text,
	`checkoutTotal` int,
	`checkoutCurrency` varchar(3),
	`retailPriceCents` int,
	`opsNotifiedAt` timestamp,
	`providerStatus` json,
	`lastProviderSyncAt` timestamp,
	`lastErrorType` varchar(128),
	`lastErrorMessage` varchar(500),
	`retryable` boolean NOT NULL DEFAULT false,
	`submissionKey` varchar(64),
	`submittedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `llc_registrations_id` PRIMARY KEY(`id`),
	CONSTRAINT `llc_registration_whop_account_unique` UNIQUE(`whopAccountId`),
	CONSTRAINT `llc_registration_checkout_unique` UNIQUE(`checkoutSessionId`)
);
--> statement-breakpoint
CREATE TABLE `llc_status_history` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registrationId` int NOT NULL,
	`fromStatus` enum('draft','ready','submitting','payment_required','processing','completed','action_required','failed'),
	`toStatus` enum('draft','ready','submitting','payment_required','processing','completed','action_required','failed') NOT NULL,
	`source` enum('user','system','whop') NOT NULL,
	`note` varchar(500),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `llc_status_history_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `llc_submission_attempts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`registrationId` int NOT NULL,
	`attemptNumber` int NOT NULL,
	`submissionKey` varchar(64) NOT NULL,
	`phase` enum('account_creation','llc_registration','status_refresh') NOT NULL,
	`outcome` enum('started','succeeded','retryable_failure','action_required','uncertain') NOT NULL DEFAULT 'started',
	`httpStatus` int,
	`whopRequestId` varchar(128),
	`providerObjectId` varchar(128),
	`errorType` varchar(128),
	`safeMessage` varchar(500),
	`retryable` boolean NOT NULL DEFAULT false,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`finishedAt` timestamp,
	CONSTRAINT `llc_submission_attempts_id` PRIMARY KEY(`id`),
	CONSTRAINT `llc_attempt_number_unique` UNIQUE(`registrationId`,`attemptNumber`,`phase`)
);
--> statement-breakpoint
CREATE INDEX `llc_founder_registration_idx` ON `llc_founders` (`registrationId`);--> statement-breakpoint
CREATE INDEX `llc_founder_primary_idx` ON `llc_founders` (`registrationId`,`isPrimary`);--> statement-breakpoint
CREATE INDEX `llc_registration_user_idx` ON `llc_registrations` (`userId`);--> statement-breakpoint
CREATE INDEX `llc_registration_status_idx` ON `llc_registrations` (`status`);--> statement-breakpoint
CREATE INDEX `llc_status_history_registration_idx` ON `llc_status_history` (`registrationId`);--> statement-breakpoint
CREATE INDEX `llc_attempt_registration_idx` ON `llc_submission_attempts` (`registrationId`);