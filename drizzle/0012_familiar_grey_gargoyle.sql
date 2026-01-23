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
