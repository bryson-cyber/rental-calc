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
