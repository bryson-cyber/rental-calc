CREATE TABLE `email_optins` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`firstName` varchar(100),
	`lastName` varchar(100),
	`city` varchar(255),
	`state` varchar(100),
	`zipCode` varchar(20),
	`wantsMarketUpdates` int NOT NULL DEFAULT 1,
	`wantsRegulationAlerts` int NOT NULL DEFAULT 1,
	`wantsSmsAlerts` int NOT NULL DEFAULT 0,
	`source` varchar(100),
	`utmSource` varchar(100),
	`utmMedium` varchar(100),
	`utmCampaign` varchar(100),
	`hubspotContactId` varchar(100),
	`hubspotSyncedAt` timestamp,
	`isActive` int NOT NULL DEFAULT 1,
	`unsubscribedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `email_optins_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `link_clicks` (
	`id` int AUTO_INCREMENT NOT NULL,
	`linkId` int NOT NULL,
	`clickedAt` timestamp NOT NULL DEFAULT (now()),
	`userIp` varchar(45),
	`userAgent` text,
	`referer` text,
	`clickCity` varchar(255),
	`clickState` varchar(100),
	`clickCountry` varchar(100),
	CONSTRAINT `link_clicks_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `personalized_links` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320),
	`hubspotContactId` varchar(100),
	`linkUrl` text NOT NULL,
	`shortCode` varchar(20),
	`targetCity` varchar(255),
	`targetState` varchar(100),
	`targetZip` varchar(20),
	`targetTab` varchar(50),
	`campaignName` varchar(255),
	`campaignType` varchar(100),
	`clickCount` int NOT NULL DEFAULT 0,
	`lastClickedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `personalized_links_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promotion_recipients` (
	`id` int AUTO_INCREMENT NOT NULL,
	`promotionId` int NOT NULL,
	`optinId` int,
	`email` varchar(320) NOT NULL,
	`personalizedLinkId` int,
	`emailSentAt` timestamp,
	`emailOpenedAt` timestamp,
	`smsSentAt` timestamp,
	`clicked` int NOT NULL DEFAULT 0,
	`unsubscribed` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `promotion_recipients_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`description` text,
	`type` enum('email','sms','both') NOT NULL DEFAULT 'email',
	`targetCity` varchar(255),
	`targetState` varchar(100),
	`targetSegment` varchar(100),
	`emailSubject` varchar(255),
	`emailPreviewText` varchar(255),
	`smsMessage` text,
	`linkTemplate` text,
	`totalSent` int NOT NULL DEFAULT 0,
	`totalOpened` int NOT NULL DEFAULT 0,
	`totalClicked` int NOT NULL DEFAULT 0,
	`totalUnsubscribed` int NOT NULL DEFAULT 0,
	`status` enum('draft','scheduled','sent','cancelled') NOT NULL DEFAULT 'draft',
	`scheduledFor` timestamp,
	`sentAt` timestamp,
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tool_usage_events` (
	`id` int AUTO_INCREMENT NOT NULL,
	`email` varchar(320),
	`sessionId` varchar(64),
	`userId` int,
	`eventType` varchar(100) NOT NULL,
	`toolName` varchar(100) NOT NULL,
	`city` varchar(255),
	`state` varchar(100),
	`zipCode` varchar(20),
	`address` text,
	`revenueEstimate` int,
	`regulationStatus` varchar(50),
	`utmSource` varchar(100),
	`utmMedium` varchar(100),
	`utmCampaign` varchar(100),
	`personalizedLinkId` int,
	`webhookSentAt` timestamp,
	`webhookSuccess` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `tool_usage_events_id` PRIMARY KEY(`id`)
);
