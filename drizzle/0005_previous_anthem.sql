CREATE TABLE `webinar_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(100) NOT NULL,
	`settingValue` varchar(500) NOT NULL,
	`updatedBy` varchar(255),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `webinar_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `webinar_settings_settingKey_unique` UNIQUE(`settingKey`)
);
