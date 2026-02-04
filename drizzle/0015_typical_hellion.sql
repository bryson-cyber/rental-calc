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
