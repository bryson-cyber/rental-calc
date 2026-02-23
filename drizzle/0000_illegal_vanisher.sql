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
CREATE TABLE `ai_advisor_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cacheType` enum('property','market') NOT NULL,
	`cacheKey` varchar(255) NOT NULL,
	`address` text,
	`city` varchar(255),
	`state` varchar(100),
	`zipCode` varchar(20),
	`bedrooms` int,
	`bathrooms` decimal(3,1),
	`marketName` varchar(255),
	`inputHash` varchar(64),
	`advice` text NOT NULL,
	`generatedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`hitCount` int NOT NULL DEFAULT 0,
	`lastAccessedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ai_advisor_cache_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_conversations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`title` varchar(255),
	`contextTool` varchar(64),
	`contextAddress` text,
	`contextMarket` varchar(255),
	`messageCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastMessageAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_conversations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ai_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`conversationId` int NOT NULL,
	`role` enum('user','assistant','system') NOT NULL,
	`content` text NOT NULL,
	`isComplete` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `ai_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `analysis_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`address` text NOT NULL,
	`city` varchar(255),
	`state` varchar(100),
	`zipCode` varchar(20),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`bedrooms` int,
	`bathrooms` decimal(3,1),
	`monthlyRent` int,
	`marketId` varchar(64),
	`marketName` varchar(255),
	`annualRevenueConservative` int,
	`annualRevenueRealistic` int,
	`annualRevenueOptimistic` int,
	`occupancyRate` decimal(5,2),
	`averageDailyRate` int,
	`revpar` int,
	`annualProfitConservative` int,
	`annualProfitRealistic` int,
	`annualProfitOptimistic` int,
	`breakEvenOccupancy` decimal(5,2),
	`startupCostsMin` int,
	`startupCostsMax` int,
	`verdict` varchar(50),
	`confidenceScore` int,
	`fullAnalysisData` json,
	`narrativeReport` json,
	`competitorData` json,
	`leadName` varchar(255),
	`leadEmail` varchar(320),
	`leadPhone` varchar(50),
	`userIp` varchar(45),
	`userAgent` text,
	`sessionId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analysis_reports_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cacheKey` varchar(500) NOT NULL,
	`cacheType` varchar(100) NOT NULL,
	`data` json NOT NULL,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `api_cache_cacheKey_unique` UNIQUE(`cacheKey`)
);
--> statement-breakpoint
CREATE TABLE `api_call_logs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(50) NOT NULL,
	`endpoint` varchar(255) NOT NULL,
	`params` json,
	`statusCode` int,
	`success` int NOT NULL DEFAULT 1,
	`errorMessage` text,
	`responseTimeMs` int,
	`cacheHit` int NOT NULL DEFAULT 0,
	`source` varchar(100),
	`userId` int,
	`sessionId` varchar(64),
	`contactId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `api_call_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `api_usage_summary` (
	`id` int AUTO_INCREMENT NOT NULL,
	`date` varchar(10) NOT NULL,
	`provider` varchar(50) NOT NULL,
	`totalCalls` int NOT NULL DEFAULT 0,
	`successfulCalls` int NOT NULL DEFAULT 0,
	`failedCalls` int NOT NULL DEFAULT 0,
	`cacheHits` int NOT NULL DEFAULT 0,
	`uniqueEndpoints` int DEFAULT 0,
	`uniqueUsers` int DEFAULT 0,
	`estimatedCost` decimal(10,2),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `api_usage_summary_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `browser_use_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text NOT NULL,
	`expiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `browser_use_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `browser_use_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `bug_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareCode` varchar(20) NOT NULL,
	`reporterEmail` varchar(320),
	`reporterName` varchar(255),
	`sessionId` varchar(64),
	`userId` int,
	`title` varchar(500) NOT NULL,
	`description` text,
	`stepsToReproduce` text,
	`expectedBehavior` text,
	`actualBehavior` text,
	`toolName` varchar(100),
	`pagePath` varchar(255),
	`propertyAddress` text,
	`city` varchar(255),
	`state` varchar(100),
	`marketId` varchar(64),
	`browserInfo` text,
	`screenSize` varchar(50),
	`errorMessage` text,
	`consoleErrors` text,
	`screenshotUrl` text,
	`status` enum('new','investigating','in_progress','resolved','wont_fix','duplicate') NOT NULL DEFAULT 'new',
	`priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
	`resolvedAt` timestamp,
	`resolution` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bug_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `bug_reports_shareCode_unique` UNIQUE(`shareCode`)
);
--> statement-breakpoint
CREATE TABLE `comment_votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`commentId` int NOT NULL,
	`userId` int NOT NULL,
	`voteType` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comment_votes_id` PRIMARY KEY(`id`),
	CONSTRAINT `comment_votes_user_comment_idx` UNIQUE(`userId`,`commentId`)
);
--> statement-breakpoint
CREATE TABLE `content_scripts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`format` varchar(20) NOT NULL,
	`topic` text NOT NULL,
	`title` varchar(500) NOT NULL,
	`hook` text NOT NULL,
	`script` text NOT NULL,
	`cta` text NOT NULL,
	`estimatedDurationSeconds` int,
	`keyDataPoints` json,
	`targetAudience` varchar(500),
	`marketDataContext` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_scripts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deal_alert_criteria` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`email` varchar(320) NOT NULL,
	`firstName` varchar(100),
	`phone` varchar(20),
	`city` varchar(255) NOT NULL,
	`state` varchar(100) NOT NULL,
	`zipCode` varchar(20),
	`marketId` varchar(64),
	`marketName` varchar(255),
	`analysisType` enum('arbitrage','investment','both') NOT NULL DEFAULT 'arbitrage',
	`minBedrooms` int DEFAULT 1,
	`maxBedrooms` int DEFAULT 5,
	`minBathrooms` decimal(3,1) DEFAULT '1',
	`maxRent` int,
	`maxPurchasePrice` int,
	`propertyTypes` json,
	`minMonthlyProfit` int DEFAULT 500,
	`minProfitMargin` decimal(5,2) DEFAULT '0.15',
	`minDealScore` int DEFAULT 50,
	`minOccupancy` decimal(5,2),
	`notifyEmail` int NOT NULL DEFAULT 1,
	`notifySms` int NOT NULL DEFAULT 0,
	`notifyInApp` int NOT NULL DEFAULT 1,
	`frequency` enum('instant','daily','weekly') NOT NULL DEFAULT 'daily',
	`isActive` int NOT NULL DEFAULT 1,
	`lastScannedAt` timestamp,
	`lastMatchFoundAt` timestamp,
	`totalMatchesFound` int NOT NULL DEFAULT 0,
	`totalAlertsSent` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `deal_alert_criteria_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deal_alert_matches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`criteriaId` int NOT NULL,
	`address` text NOT NULL,
	`city` varchar(255) NOT NULL,
	`state` varchar(100) NOT NULL,
	`zipCode` varchar(20),
	`bedrooms` int,
	`bathrooms` decimal(3,1),
	`monthlyRent` int,
	`purchasePrice` int,
	`propertyType` varchar(100),
	`sourceUrl` text,
	`sourcePlatform` varchar(50),
	`imageUrl` text,
	`projectedRevenue` int,
	`projectedAdr` int,
	`projectedOccupancy` decimal(5,2),
	`projectedMonthlyProfit` int,
	`projectedAnnualProfit` int,
	`profitMargin` decimal(5,2),
	`dealScore` int,
	`dealGrade` varchar(2),
	`status` enum('new','notified','viewed','saved','dismissed') NOT NULL DEFAULT 'new',
	`notifiedAt` timestamp,
	`viewedAt` timestamp,
	`discoveredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `deal_alert_matches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `deep_analysis` (
	`id` int AUTO_INCREMENT NOT NULL,
	`reportId` int NOT NULL,
	`status` enum('pending','processing','completed','failed') NOT NULL DEFAULT 'pending',
	`currentStep` varchar(100),
	`completedSteps` json,
	`errorMessage` text,
	`historicalContext` json,
	`investmentThesis` json,
	`riskNarrative` json,
	`pricingStrategy` json,
	`competitorPhotoAnalysis` json,
	`executiveSummaryEnhanced` text,
	`marketNarrative` text,
	`actionPlan` json,
	`processingTimeMs` int,
	`aiProvider` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`completedAt` timestamp,
	CONSTRAINT `deep_analysis_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
CREATE TABLE `favorite_listings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`listingId` varchar(100) NOT NULL,
	`title` varchar(500),
	`bedrooms` int,
	`bathrooms` decimal(3,1),
	`revenue` int,
	`occupancy` decimal(5,2),
	`adr` int,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`airbnbUrl` text,
	`thumbnailUrl` text,
	`searchAddress` text,
	`searchSubmarketId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `favorite_listings_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `favorite_markets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`marketId` varchar(64) NOT NULL,
	`marketName` varchar(255) NOT NULL,
	`marketType` varchar(100),
	`state` varchar(100),
	`country` varchar(100),
	`marketScore` decimal(5,2),
	`listingCount` int,
	`averageRevenue` int,
	`averageOccupancy` decimal(5,2),
	`averageAdr` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `favorite_markets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `favorite_properties` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`address` text NOT NULL,
	`city` varchar(255),
	`state` varchar(100),
	`zipCode` varchar(20),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`zillowUrl` text,
	`imageUrl` text,
	`bedrooms` int,
	`bathrooms` decimal(3,1),
	`propertyType` varchar(100),
	`marketId` varchar(64),
	`marketName` varchar(255),
	`annualRevenue` int,
	`monthlyRevenue` int,
	`occupancyRate` decimal(5,2),
	`averageDailyRate` int,
	`monthlyRent` int,
	`estimatedProfit` int,
	`purchasePrice` int,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `favorite_properties_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `leads` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(320) NOT NULL,
	`phone` varchar(50),
	`address` text NOT NULL,
	`bedrooms` int,
	`bathrooms` decimal(3,1),
	`accommodates` int,
	`zillowUrl` text,
	`annualRevenue` int,
	`averageDailyRate` int,
	`occupancyRate` decimal(5,2),
	`marketId` varchar(64),
	`marketName` varchar(255),
	`status` enum('new','contacted','qualified','converted','closed') NOT NULL DEFAULT 'new',
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `leads_id` PRIMARY KEY(`id`)
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
CREATE TABLE `market_alerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`email` varchar(320) NOT NULL,
	`marketId` varchar(64) NOT NULL,
	`marketName` varchar(255) NOT NULL,
	`alertType` enum('revenue_change','occupancy_change','adr_change','all_changes') NOT NULL DEFAULT 'all_changes',
	`thresholdPercent` int NOT NULL DEFAULT 10,
	`baselineRevenue` int,
	`baselineOccupancy` decimal(5,2),
	`baselineAdr` int,
	`isActive` enum('true','false') NOT NULL DEFAULT 'true',
	`lastCheckedAt` timestamp,
	`lastAlertSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `market_alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `market_evaluations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`email` varchar(320),
	`city` varchar(255) NOT NULL,
	`state` varchar(100) NOT NULL,
	`marketId` varchar(64),
	`marketName` varchar(255),
	`analysisType` enum('arbitrage','investment','both') NOT NULL DEFAULT 'both',
	`bedrooms` int DEFAULT 3,
	`status` enum('pending','running','completed','failed') NOT NULL DEFAULT 'pending',
	`currentStep` varchar(100),
	`progress` int DEFAULT 0,
	`regulationsData` json,
	`marketOverviewData` json,
	`revenueData` json,
	`compsData` json,
	`topPropertiesData` json,
	`aiMemo` text,
	`marketScore` int,
	`averageRevenue` int,
	`averageOccupancy` decimal(5,2),
	`averageAdr` int,
	`regulationRisk` varchar(20),
	`errorMessage` text,
	`startedAt` timestamp,
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `market_evaluations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
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
--> statement-breakpoint
CREATE TABLE `newsletter_cities` (
	`id` int AUTO_INCREMENT NOT NULL,
	`city` varchar(255) NOT NULL,
	`state` varchar(100) NOT NULL,
	`postalCode` varchar(20),
	`airdnaMarketId` varchar(64),
	`airdnaMarketName` varchar(255),
	`contactCount` int NOT NULL DEFAULT 0,
	`lastMarketDataSync` timestamp,
	`lastDealScan` timestamp,
	`cachedAdr` int,
	`cachedOccupancy` decimal(5,2),
	`cachedRevenue` int,
	`cachedMarketScore` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `newsletter_cities_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletter_cities_city_state_idx` UNIQUE(`city`,`state`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_deals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cityId` int NOT NULL,
	`address` text NOT NULL,
	`city` varchar(255) NOT NULL,
	`state` varchar(100) NOT NULL,
	`zipCode` varchar(20),
	`bedrooms` int,
	`bathrooms` decimal(3,1),
	`monthlyRent` int,
	`propertyType` varchar(100),
	`sourceUrl` text,
	`sourcePlatform` varchar(50),
	`imageUrl` text,
	`projectedRevenue` int,
	`projectedAdr` int,
	`projectedOccupancy` decimal(5,2),
	`projectedProfit` int,
	`dealScore` int,
	`profitMargin` decimal(5,2),
	`status` enum('active','sent','expired','removed') NOT NULL DEFAULT 'active',
	`discoveredAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	`expiresAt` timestamp,
	CONSTRAINT `newsletter_deals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobType` enum('sync_contacts','scan_deals','send_weekly','send_deals') NOT NULL,
	`status` enum('running','completed','failed') NOT NULL DEFAULT 'running',
	`citiesProcessed` int DEFAULT 0,
	`contactsProcessed` int DEFAULT 0,
	`dealsFound` int DEFAULT 0,
	`emailsSent` int DEFAULT 0,
	`errorCount` int DEFAULT 0,
	`errors` json,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`durationMs` int,
	CONSTRAINT `newsletter_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_preferences` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hubspotContactId` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`weeklyMarketEnabled` int NOT NULL DEFAULT 1,
	`dealAlertsEnabled` int NOT NULL DEFAULT 1,
	`monthlyReportEnabled` int NOT NULL DEFAULT 1,
	`smsAlertsEnabled` int NOT NULL DEFAULT 0,
	`dealAlertFrequency` enum('instant','daily','weekly') NOT NULL DEFAULT 'daily',
	`unsubscribedAt` timestamp,
	`unsubscribeReason` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `newsletter_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `newsletter_preferences_hubspotContactId_unique` UNIQUE(`hubspotContactId`)
);
--> statement-breakpoint
CREATE TABLE `newsletter_sends` (
	`id` int AUTO_INCREMENT NOT NULL,
	`hubspotContactId` varchar(64) NOT NULL,
	`email` varchar(320) NOT NULL,
	`firstName` varchar(255),
	`lastName` varchar(255),
	`city` varchar(255),
	`state` varchar(100),
	`emailType` enum('weekly_market','deal_alert','monthly_report') NOT NULL,
	`dealId` int,
	`cityId` int,
	`hubspotEmailId` varchar(64),
	`hubspotSendId` varchar(128),
	`status` enum('queued','sent','delivered','opened','clicked','bounced','failed') NOT NULL DEFAULT 'queued',
	`errorMessage` text,
	`openedAt` timestamp,
	`clickedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	CONSTRAINT `newsletter_sends_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notification_analytics` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notificationType` enum('sms','email') NOT NULL,
	`reportType` enum('regulation','revenue','validator','market','ai_advisor','listings','comparison','map') NOT NULL,
	`shareCode` varchar(20) NOT NULL,
	`recipientPhone` varchar(50),
	`recipientEmail` varchar(320),
	`recipientName` varchar(255),
	`city` varchar(255),
	`state` varchar(100),
	`address` text,
	`status` enum('pending','sent','delivered','failed','opened','clicked') NOT NULL DEFAULT 'pending',
	`errorMessage` text,
	`openedAt` timestamp,
	`clickedAt` timestamp,
	`isAutoNotification` int DEFAULT 0,
	`triggeredBy` varchar(100),
	`senderUserId` int,
	`sessionId` varchar(64),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`sentAt` timestamp,
	CONSTRAINT `notification_analytics_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`type` enum('report_generated','system','alert','info') NOT NULL,
	`title` varchar(255) NOT NULL,
	`message` text NOT NULL,
	`metadata` json,
	`isRead` int NOT NULL DEFAULT 0,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `notifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `owner_notification_log` (
	`id` int AUTO_INCREMENT NOT NULL,
	`notificationType` enum('property_report','market_report','lead_capture','system') NOT NULL,
	`reportId` int,
	`title` varchar(255) NOT NULL,
	`summary` text,
	`triggeredByIp` varchar(45),
	`triggeredByUserId` int,
	`deliveryStatus` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`deliveredAt` timestamp,
	`errorMessage` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `owner_notification_log_id` PRIMARY KEY(`id`)
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
CREATE TABLE `property_images` (
	`id` int AUTO_INCREMENT NOT NULL,
	`propertyId` varchar(100) NOT NULL,
	`platform` varchar(50),
	`images` json NOT NULL,
	`imageCount` int NOT NULL,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `property_images_id` PRIMARY KEY(`id`),
	CONSTRAINT `property_images_propertyId_unique` UNIQUE(`propertyId`)
);
--> statement-breakpoint
CREATE TABLE `regulation_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`locationKey` varchar(255) NOT NULL,
	`city` varchar(255) NOT NULL,
	`state` varchar(100) NOT NULL,
	`status` varchar(50) NOT NULL,
	`yesNoSummary` text,
	`summary` text,
	`simplifiedSummary` text,
	`keyRequirements` json,
	`permitRequired` int DEFAULT 0,
	`primaryResidenceOnly` int DEFAULT 0,
	`maxNightsPerYear` int,
	`registrationFee` varchar(100),
	`occupancyTax` varchar(100),
	`zoningRestrictions` text,
	`sources` json,
	`confidence` varchar(20),
	`warnings` json,
	`expiresAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `regulation_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `regulation_cache_locationKey_unique` UNIQUE(`locationKey`)
);
--> statement-breakpoint
CREATE TABLE `regulation_comments` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`locationKey` varchar(255) NOT NULL,
	`city` varchar(255) NOT NULL,
	`state` varchar(100) NOT NULL,
	`content` text NOT NULL,
	`upvotes` int NOT NULL DEFAULT 0,
	`downvotes` int NOT NULL DEFAULT 0,
	`isApproved` int NOT NULL DEFAULT 1,
	`isFlagged` int NOT NULL DEFAULT 0,
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
	`sources` json,
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_regulations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `saved_searches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`searchType` enum('market','property') NOT NULL,
	`marketId` varchar(64),
	`marketName` varchar(255),
	`submarketId` varchar(64),
	`submarketName` varchar(255),
	`address` text,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`bedrooms` int,
	`bathrooms` decimal(3,1),
	`cachedRevenue` int,
	`cachedOccupancy` decimal(5,2),
	`cachedAdr` int,
	`label` varchar(255),
	`notes` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `saved_searches_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `scheduled_sms_messages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarId` varchar(100) NOT NULL,
	`sequenceName` varchar(255) NOT NULL,
	`sequenceOrder` int NOT NULL,
	`messageBody` text NOT NULL,
	`scheduledAt` timestamp NOT NULL,
	`status` enum('pending','sending','sent','failed','cancelled') NOT NULL DEFAULT 'pending',
	`audience` enum('all','attended','not_attended') NOT NULL DEFAULT 'all',
	`sentCount` int DEFAULT 0,
	`failedCount` int DEFAULT 0,
	`sentAt` timestamp,
	`error` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `scheduled_sms_messages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shareable_regulation_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareCode` varchar(20) NOT NULL,
	`city` varchar(255) NOT NULL,
	`state` varchar(100) NOT NULL,
	`locationKey` varchar(255) NOT NULL,
	`status` varchar(50) NOT NULL,
	`yesNoSummary` text,
	`summary` text,
	`permitRequired` int DEFAULT 0,
	`primaryResidenceOnly` int DEFAULT 0,
	`maxNightsPerYear` int,
	`registrationFee` varchar(255),
	`occupancyTax` varchar(100),
	`confidence` varchar(20),
	`fullRegulationData` json,
	`keyRequirements` json,
	`sources` json,
	`creatorEmail` varchar(320),
	`creatorPhone` varchar(50),
	`creatorUserId` int,
	`sessionId` varchar(64),
	`viewCount` int NOT NULL DEFAULT 0,
	`lastViewedAt` timestamp,
	`smsSentTo` varchar(50),
	`smsSentAt` timestamp,
	`emailSentTo` varchar(320),
	`emailSentAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `shareable_regulation_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `shareable_regulation_reports_shareCode_unique` UNIQUE(`shareCode`)
);
--> statement-breakpoint
CREATE TABLE `shared_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareId` varchar(32) NOT NULL,
	`reportType` enum('property','market','full') NOT NULL,
	`address` text,
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`bedrooms` int,
	`bathrooms` decimal(3,1),
	`accommodates` int,
	`marketId` varchar(64),
	`marketName` varchar(255),
	`submarketId` varchar(64),
	`submarketName` varchar(255),
	`reportData` text,
	`createdByUserId` int,
	`createdByName` varchar(255),
	`expiresAt` timestamp,
	`viewCount` int NOT NULL DEFAULT 0,
	`maxViews` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `shared_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `shared_reports_shareId_unique` UNIQUE(`shareId`)
);
--> statement-breakpoint
CREATE TABLE `slack_report_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sentByUserId` int,
	`sentByName` varchar(255),
	`channelId` varchar(50) NOT NULL,
	`channelName` varchar(255),
	`shareCode` varchar(100) NOT NULL,
	`reportSource` varchar(20) NOT NULL,
	`address` text,
	`reportType` varchar(50),
	`dealSummary` text,
	`customMessage` text,
	`status` enum('sent','failed','pending') NOT NULL DEFAULT 'pending',
	`slackPermalink` text,
	`errorMessage` text,
	`batchId` varchar(50),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `slack_report_deliveries_id` PRIMARY KEY(`id`)
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
--> statement-breakpoint
CREATE TABLE `translation_cache` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceHash` varchar(64) NOT NULL,
	`sourceText` text NOT NULL,
	`targetLang` varchar(10) NOT NULL,
	`translatedText` text NOT NULL,
	`context` varchar(255),
	`hitCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `translation_cache_id` PRIMARY KEY(`id`),
	CONSTRAINT `tc_hash_lang_idx` UNIQUE(`sourceHash`,`targetLang`)
);
--> statement-breakpoint
CREATE TABLE `universal_shareable_reports` (
	`id` int AUTO_INCREMENT NOT NULL,
	`shareCode` varchar(20) NOT NULL,
	`reportType` enum('revenue','validator','market','ai_advisor','listings','comparison','map','regulation') NOT NULL,
	`address` text,
	`city` varchar(255),
	`state` varchar(100),
	`zipCode` varchar(20),
	`latitude` decimal(10,7),
	`longitude` decimal(10,7),
	`bedrooms` int,
	`bathrooms` decimal(3,1),
	`monthlyRent` int,
	`marketId` varchar(64),
	`marketName` varchar(255),
	`reportData` json,
	`title` varchar(500),
	`summary` text,
	`annualRevenue` int,
	`occupancyRate` decimal(5,2),
	`averageDailyRate` int,
	`profitMargin` decimal(5,2),
	`verdict` varchar(50),
	`creatorEmail` varchar(320),
	`creatorPhone` varchar(50),
	`creatorName` varchar(255),
	`creatorUserId` int,
	`sessionId` varchar(64),
	`viewCount` int NOT NULL DEFAULT 0,
	`lastViewedAt` timestamp,
	`smsSentTo` varchar(50),
	`smsSentAt` timestamp,
	`emailSentTo` varchar(320),
	`emailSentAt` timestamp,
	`autoNotificationSent` int DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp,
	CONSTRAINT `universal_shareable_reports_id` PRIMARY KEY(`id`),
	CONSTRAINT `universal_shareable_reports_shareCode_unique` UNIQUE(`shareCode`)
);
--> statement-breakpoint
CREATE TABLE `usage_limits_config` (
	`id` int AUTO_INCREMENT NOT NULL,
	`limitType` varchar(50) NOT NULL,
	`dailyLimit` int NOT NULL,
	`description` text,
	`isActive` int NOT NULL DEFAULT 1,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `usage_limits_config_id` PRIMARY KEY(`id`),
	CONSTRAINT `usage_limits_config_limitType_unique` UNIQUE(`limitType`)
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
--> statement-breakpoint
CREATE TABLE `user_usage` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int,
	`sessionId` varchar(64),
	`ipAddress` varchar(45),
	`date` varchar(10) NOT NULL,
	`propertyAnalyses` int NOT NULL DEFAULT 0,
	`marketResearches` int NOT NULL DEFAULT 0,
	`apiCallsCount` int NOT NULL DEFAULT 0,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_usage_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`phone` varchar(50),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	`reportMode` enum('pro','guided'),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
CREATE TABLE `video_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`golpoJobId` varchar(128),
	`scriptId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`videoUrl` text,
	`videoScript` text,
	`error` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `video_jobs_jobId_unique` UNIQUE(`jobId`)
);
--> statement-breakpoint
CREATE TABLE `webinar_registrants` (
	`id` int AUTO_INCREMENT NOT NULL,
	`webinarId` varchar(100),
	`name` varchar(255) NOT NULL,
	`email` varchar(320),
	`phone` varchar(50) NOT NULL,
	`source` varchar(50) NOT NULL DEFAULT 'manual',
	`webinarName` varchar(500),
	`webinarDate` timestamp,
	`attended` int DEFAULT 0,
	`optedOut` int DEFAULT 0,
	`tags` json,
	`metadata` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_registrants_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_sms_campaigns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`messageBody` text NOT NULL,
	`templateId` int,
	`filterCriteria` json,
	`totalRecipients` int NOT NULL DEFAULT 0,
	`sentCount` int NOT NULL DEFAULT 0,
	`failedCount` int NOT NULL DEFAULT 0,
	`campaignStatus` enum('draft','sending','completed','failed') NOT NULL DEFAULT 'draft',
	`createdBy` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `webinar_sms_campaigns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_sms_deliveries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`campaignId` int NOT NULL,
	`registrantId` int NOT NULL,
	`phone` varchar(50) NOT NULL,
	`deliveryStatus` varchar(50) NOT NULL DEFAULT 'pending',
	`externalMessageId` varchar(255),
	`error` text,
	`sentAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `webinar_sms_deliveries_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `webinar_sms_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` text NOT NULL,
	`description` text,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_sms_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `webinar_sms_settings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `webinar_sms_templates` (
	`id` int AUTO_INCREMENT NOT NULL,
	`name` varchar(255) NOT NULL,
	`body` text NOT NULL,
	`category` varchar(50) NOT NULL DEFAULT 'custom',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_sms_templates_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `activity_logs_user_id_idx` ON `activity_logs` (`userId`);--> statement-breakpoint
CREATE INDEX `activity_logs_session_id_idx` ON `activity_logs` (`sessionId`);--> statement-breakpoint
CREATE INDEX `activity_logs_action_idx` ON `activity_logs` (`action`);--> statement-breakpoint
CREATE INDEX `activity_logs_created_at_idx` ON `activity_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ai_advisor_cache_key_idx` ON `ai_advisor_cache` (`cacheKey`);--> statement-breakpoint
CREATE INDEX `ai_advisor_cache_type_idx` ON `ai_advisor_cache` (`cacheType`);--> statement-breakpoint
CREATE INDEX `ai_advisor_cache_expires_idx` ON `ai_advisor_cache` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `ai_conv_user_id_idx` ON `ai_conversations` (`userId`);--> statement-breakpoint
CREATE INDEX `ai_conv_session_id_idx` ON `ai_conversations` (`sessionId`);--> statement-breakpoint
CREATE INDEX `ai_messages_conversation_id_idx` ON `ai_messages` (`conversationId`);--> statement-breakpoint
CREATE INDEX `analysis_reports_session_id_idx` ON `analysis_reports` (`sessionId`);--> statement-breakpoint
CREATE INDEX `analysis_reports_market_id_idx` ON `analysis_reports` (`marketId`);--> statement-breakpoint
CREATE INDEX `analysis_reports_created_at_idx` ON `analysis_reports` (`createdAt`);--> statement-breakpoint
CREATE INDEX `api_cache_type_idx` ON `api_cache` (`cacheType`);--> statement-breakpoint
CREATE INDEX `api_cache_expires_idx` ON `api_cache` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `api_call_logs_provider_idx` ON `api_call_logs` (`provider`);--> statement-breakpoint
CREATE INDEX `api_call_logs_created_at_idx` ON `api_call_logs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `api_call_logs_source_idx` ON `api_call_logs` (`source`);--> statement-breakpoint
CREATE INDEX `api_usage_date_provider_idx` ON `api_usage_summary` (`date`,`provider`);--> statement-breakpoint
CREATE INDEX `bug_reports_status_idx` ON `bug_reports` (`status`);--> statement-breakpoint
CREATE INDEX `bug_reports_priority_idx` ON `bug_reports` (`priority`);--> statement-breakpoint
CREATE INDEX `cs_user_idx` ON `content_scripts` (`userId`);--> statement-breakpoint
CREATE INDEX `cs_format_idx` ON `content_scripts` (`format`);--> statement-breakpoint
CREATE INDEX `cs_created_idx` ON `content_scripts` (`createdAt`);--> statement-breakpoint
CREATE INDEX `deal_alert_user_id_idx` ON `deal_alert_criteria` (`userId`);--> statement-breakpoint
CREATE INDEX `deal_alert_email_idx` ON `deal_alert_criteria` (`email`);--> statement-breakpoint
CREATE INDEX `deal_alert_city_state_idx` ON `deal_alert_criteria` (`city`,`state`);--> statement-breakpoint
CREATE INDEX `deal_alert_is_active_idx` ON `deal_alert_criteria` (`isActive`);--> statement-breakpoint
CREATE INDEX `deal_matches_criteria_id_idx` ON `deal_alert_matches` (`criteriaId`);--> statement-breakpoint
CREATE INDEX `deal_matches_status_idx` ON `deal_alert_matches` (`status`);--> statement-breakpoint
CREATE INDEX `deep_analysis_report_id_idx` ON `deep_analysis` (`reportId`);--> statement-breakpoint
CREATE INDEX `deep_analysis_status_idx` ON `deep_analysis` (`status`);--> statement-breakpoint
CREATE INDEX `email_optins_email_idx` ON `email_optins` (`email`);--> statement-breakpoint
CREATE INDEX `email_optins_is_active_idx` ON `email_optins` (`isActive`);--> statement-breakpoint
CREATE INDEX `email_optins_city_state_idx` ON `email_optins` (`city`,`state`);--> statement-breakpoint
CREATE INDEX `fav_listings_user_id_idx` ON `favorite_listings` (`userId`);--> statement-breakpoint
CREATE INDEX `fav_listings_session_id_idx` ON `favorite_listings` (`sessionId`);--> statement-breakpoint
CREATE INDEX `fav_listings_listing_id_idx` ON `favorite_listings` (`listingId`);--> statement-breakpoint
CREATE INDEX `fav_markets_user_id_idx` ON `favorite_markets` (`userId`);--> statement-breakpoint
CREATE INDEX `fav_markets_session_id_idx` ON `favorite_markets` (`sessionId`);--> statement-breakpoint
CREATE INDEX `fav_markets_market_id_idx` ON `favorite_markets` (`marketId`);--> statement-breakpoint
CREATE INDEX `fav_props_user_id_idx` ON `favorite_properties` (`userId`);--> statement-breakpoint
CREATE INDEX `fav_props_session_id_idx` ON `favorite_properties` (`sessionId`);--> statement-breakpoint
CREATE INDEX `fav_props_market_id_idx` ON `favorite_properties` (`marketId`);--> statement-breakpoint
CREATE INDEX `leads_email_idx` ON `leads` (`email`);--> statement-breakpoint
CREATE INDEX `leads_status_idx` ON `leads` (`status`);--> statement-breakpoint
CREATE INDEX `leads_created_at_idx` ON `leads` (`createdAt`);--> statement-breakpoint
CREATE INDEX `link_clicks_link_id_idx` ON `link_clicks` (`linkId`);--> statement-breakpoint
CREATE INDEX `market_alerts_user_id_idx` ON `market_alerts` (`userId`);--> statement-breakpoint
CREATE INDEX `market_alerts_market_id_idx` ON `market_alerts` (`marketId`);--> statement-breakpoint
CREATE INDEX `market_alerts_is_active_idx` ON `market_alerts` (`isActive`);--> statement-breakpoint
CREATE INDEX `market_eval_user_id_idx` ON `market_evaluations` (`userId`);--> statement-breakpoint
CREATE INDEX `market_eval_session_id_idx` ON `market_evaluations` (`sessionId`);--> statement-breakpoint
CREATE INDEX `market_eval_city_state_idx` ON `market_evaluations` (`city`,`state`);--> statement-breakpoint
CREATE INDEX `market_eval_status_idx` ON `market_evaluations` (`status`);--> statement-breakpoint
CREATE INDEX `market_research_status_idx` ON `market_research_reports` (`status`);--> statement-breakpoint
CREATE INDEX `market_research_user_id_idx` ON `market_research_reports` (`userId`);--> statement-breakpoint
CREATE INDEX `market_research_created_at_idx` ON `market_research_reports` (`createdAt`);--> statement-breakpoint
CREATE INDEX `newsletter_deals_city_id_idx` ON `newsletter_deals` (`cityId`);--> statement-breakpoint
CREATE INDEX `newsletter_deals_status_idx` ON `newsletter_deals` (`status`);--> statement-breakpoint
CREATE INDEX `newsletter_sends_contact_id_idx` ON `newsletter_sends` (`hubspotContactId`);--> statement-breakpoint
CREATE INDEX `newsletter_sends_email_idx` ON `newsletter_sends` (`email`);--> statement-breakpoint
CREATE INDEX `newsletter_sends_status_idx` ON `newsletter_sends` (`status`);--> statement-breakpoint
CREATE INDEX `notif_analytics_share_code_idx` ON `notification_analytics` (`shareCode`);--> statement-breakpoint
CREATE INDEX `notif_analytics_status_idx` ON `notification_analytics` (`status`);--> statement-breakpoint
CREATE INDEX `notif_analytics_created_at_idx` ON `notification_analytics` (`createdAt`);--> statement-breakpoint
CREATE INDEX `notifications_user_id_idx` ON `notifications` (`userId`);--> statement-breakpoint
CREATE INDEX `notifications_is_read_idx` ON `notifications` (`isRead`);--> statement-breakpoint
CREATE INDEX `notifications_created_at_idx` ON `notifications` (`createdAt`);--> statement-breakpoint
CREATE INDEX `personalized_links_email_idx` ON `personalized_links` (`email`);--> statement-breakpoint
CREATE INDEX `personalized_links_short_code_idx` ON `personalized_links` (`shortCode`);--> statement-breakpoint
CREATE INDEX `personalized_links_campaign_idx` ON `personalized_links` (`campaignType`);--> statement-breakpoint
CREATE INDEX `promo_recipients_promo_id_idx` ON `promotion_recipients` (`promotionId`);--> statement-breakpoint
CREATE INDEX `promo_recipients_email_idx` ON `promotion_recipients` (`email`);--> statement-breakpoint
CREATE INDEX `property_images_platform_idx` ON `property_images` (`platform`);--> statement-breakpoint
CREATE INDEX `property_images_expires_at_idx` ON `property_images` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `regulation_cache_expires_idx` ON `regulation_cache` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `regulation_cache_status_idx` ON `regulation_cache` (`status`);--> statement-breakpoint
CREATE INDEX `reg_comments_user_id_idx` ON `regulation_comments` (`userId`);--> statement-breakpoint
CREATE INDEX `reg_comments_location_key_idx` ON `regulation_comments` (`locationKey`);--> statement-breakpoint
CREATE INDEX `saved_regs_user_id_idx` ON `saved_regulations` (`userId`);--> statement-breakpoint
CREATE INDEX `saved_regs_location_key_idx` ON `saved_regulations` (`locationKey`);--> statement-breakpoint
CREATE INDEX `saved_searches_user_id_idx` ON `saved_searches` (`userId`);--> statement-breakpoint
CREATE INDEX `saved_searches_session_id_idx` ON `saved_searches` (`sessionId`);--> statement-breakpoint
CREATE INDEX `saved_searches_search_type_idx` ON `saved_searches` (`searchType`);--> statement-breakpoint
CREATE INDEX `ssm_webinar_idx` ON `scheduled_sms_messages` (`webinarId`);--> statement-breakpoint
CREATE INDEX `ssm_status_idx` ON `scheduled_sms_messages` (`status`);--> statement-breakpoint
CREATE INDEX `ssm_scheduled_at_idx` ON `scheduled_sms_messages` (`scheduledAt`);--> statement-breakpoint
CREATE INDEX `ssm_sequence_order_idx` ON `scheduled_sms_messages` (`sequenceOrder`);--> statement-breakpoint
CREATE INDEX `shareable_reg_location_idx` ON `shareable_regulation_reports` (`locationKey`);--> statement-breakpoint
CREATE INDEX `shareable_reg_creator_idx` ON `shareable_regulation_reports` (`creatorUserId`);--> statement-breakpoint
CREATE INDEX `shareable_reg_created_at_idx` ON `shareable_regulation_reports` (`createdAt`);--> statement-breakpoint
CREATE INDEX `shared_reports_user_id_idx` ON `shared_reports` (`createdByUserId`);--> statement-breakpoint
CREATE INDEX `shared_reports_report_type_idx` ON `shared_reports` (`reportType`);--> statement-breakpoint
CREATE INDEX `shared_reports_created_at_idx` ON `shared_reports` (`createdAt`);--> statement-breakpoint
CREATE INDEX `slack_delivery_channel_idx` ON `slack_report_deliveries` (`channelId`);--> statement-breakpoint
CREATE INDEX `slack_delivery_status_idx` ON `slack_report_deliveries` (`status`);--> statement-breakpoint
CREATE INDEX `slack_delivery_batch_idx` ON `slack_report_deliveries` (`batchId`);--> statement-breakpoint
CREATE INDEX `slack_delivery_created_idx` ON `slack_report_deliveries` (`createdAt`);--> statement-breakpoint
CREATE INDEX `tool_usage_email_idx` ON `tool_usage_events` (`email`);--> statement-breakpoint
CREATE INDEX `tool_usage_session_id_idx` ON `tool_usage_events` (`sessionId`);--> statement-breakpoint
CREATE INDEX `tool_usage_user_id_idx` ON `tool_usage_events` (`userId`);--> statement-breakpoint
CREATE INDEX `tool_usage_event_type_idx` ON `tool_usage_events` (`eventType`);--> statement-breakpoint
CREATE INDEX `tool_usage_created_at_idx` ON `tool_usage_events` (`createdAt`);--> statement-breakpoint
CREATE INDEX `tool_usage_city_state_idx` ON `tool_usage_events` (`city`,`state`);--> statement-breakpoint
CREATE INDEX `tc_target_lang_idx` ON `translation_cache` (`targetLang`);--> statement-breakpoint
CREATE INDEX `tc_hit_count_idx` ON `translation_cache` (`hitCount`);--> statement-breakpoint
CREATE INDEX `universal_reports_type_idx` ON `universal_shareable_reports` (`reportType`);--> statement-breakpoint
CREATE INDEX `universal_reports_created_at_idx` ON `universal_shareable_reports` (`createdAt`);--> statement-breakpoint
CREATE INDEX `user_sessions_user_id_idx` ON `user_sessions` (`userId`);--> statement-breakpoint
CREATE INDEX `user_sessions_last_activity_idx` ON `user_sessions` (`lastActivityAt`);--> statement-breakpoint
CREATE INDEX `user_usage_user_id_date_idx` ON `user_usage` (`userId`,`date`);--> statement-breakpoint
CREATE INDEX `user_usage_session_id_date_idx` ON `user_usage` (`sessionId`,`date`);--> statement-breakpoint
CREATE INDEX `user_usage_ip_date_idx` ON `user_usage` (`ipAddress`,`date`);--> statement-breakpoint
CREATE INDEX `users_email_idx` ON `users` (`email`);--> statement-breakpoint
CREATE INDEX `users_role_idx` ON `users` (`role`);--> statement-breakpoint
CREATE INDEX `users_created_at_idx` ON `users` (`createdAt`);--> statement-breakpoint
CREATE INDEX `vj_job_id_idx` ON `video_jobs` (`jobId`);--> statement-breakpoint
CREATE INDEX `vj_golpo_job_id_idx` ON `video_jobs` (`golpoJobId`);--> statement-breakpoint
CREATE INDEX `vj_script_id_idx` ON `video_jobs` (`scriptId`);--> statement-breakpoint
CREATE INDEX `vj_status_idx` ON `video_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `vj_created_idx` ON `video_jobs` (`createdAt`);--> statement-breakpoint
CREATE INDEX `wr_phone_idx` ON `webinar_registrants` (`phone`);--> statement-breakpoint
CREATE INDEX `wr_email_idx` ON `webinar_registrants` (`email`);--> statement-breakpoint
CREATE INDEX `wr_webinar_id_idx` ON `webinar_registrants` (`webinarId`);--> statement-breakpoint
CREATE INDEX `wr_source_idx` ON `webinar_registrants` (`source`);--> statement-breakpoint
CREATE INDEX `wr_created_idx` ON `webinar_registrants` (`createdAt`);--> statement-breakpoint
CREATE INDEX `wsc_status_idx` ON `webinar_sms_campaigns` (`campaignStatus`);--> statement-breakpoint
CREATE INDEX `wsc_created_idx` ON `webinar_sms_campaigns` (`createdAt`);--> statement-breakpoint
CREATE INDEX `wsd_campaign_idx` ON `webinar_sms_deliveries` (`campaignId`);--> statement-breakpoint
CREATE INDEX `wsd_registrant_idx` ON `webinar_sms_deliveries` (`registrantId`);--> statement-breakpoint
CREATE INDEX `wsd_status_idx` ON `webinar_sms_deliveries` (`deliveryStatus`);