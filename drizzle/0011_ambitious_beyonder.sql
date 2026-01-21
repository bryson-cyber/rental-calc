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
