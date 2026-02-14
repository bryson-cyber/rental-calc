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
CREATE INDEX `tc_target_lang_idx` ON `translation_cache` (`targetLang`);--> statement-breakpoint
CREATE INDEX `tc_hit_count_idx` ON `translation_cache` (`hitCount`);