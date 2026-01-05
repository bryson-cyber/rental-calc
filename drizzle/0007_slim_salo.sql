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
