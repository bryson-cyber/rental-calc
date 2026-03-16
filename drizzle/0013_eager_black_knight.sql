ALTER TABLE `content_hub_videos` ADD `slug` varchar(200);--> statement-breakpoint
ALTER TABLE `content_hub_videos` ADD CONSTRAINT `chv_slug_idx` UNIQUE(`slug`);