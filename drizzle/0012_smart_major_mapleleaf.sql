ALTER TABLE `content_hub_videos` MODIFY COLUMN `ttsStyle` varchar(50) DEFAULT 'solo-female-3';--> statement-breakpoint
ALTER TABLE `content_hub_presets` ADD `videoType` varchar(10) DEFAULT 'long';--> statement-breakpoint
ALTER TABLE `content_hub_presets` ADD `ttsModel` varchar(20) DEFAULT 'accurate';--> statement-breakpoint
ALTER TABLE `content_hub_presets` ADD `whiteBg` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `content_hub_presets` ADD `outputVolume` varchar(10) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE `content_hub_presets` ADD `bgVolume` varchar(10) DEFAULT '0.3';--> statement-breakpoint
ALTER TABLE `content_hub_presets` ADD `visualStyle` varchar(30) DEFAULT 'default';--> statement-breakpoint
ALTER TABLE `content_hub_presets` ADD `canvasImageStyle` varchar(30);--> statement-breakpoint
ALTER TABLE `content_hub_presets` ADD `canvasPenStyle` varchar(20);--> statement-breakpoint
ALTER TABLE `content_hub_presets` ADD `logoUrl` text;--> statement-breakpoint
ALTER TABLE `content_hub_presets` ADD `logoPlacement` varchar(5) DEFAULT 'tl';--> statement-breakpoint
ALTER TABLE `content_hub_videos` ADD `videoType` varchar(10) DEFAULT 'long';--> statement-breakpoint
ALTER TABLE `content_hub_videos` ADD `ttsModel` varchar(20) DEFAULT 'accurate';--> statement-breakpoint
ALTER TABLE `content_hub_videos` ADD `whiteBg` tinyint DEFAULT 1;--> statement-breakpoint
ALTER TABLE `content_hub_videos` ADD `outputVolume` varchar(10) DEFAULT '1.0';--> statement-breakpoint
ALTER TABLE `content_hub_videos` ADD `bgVolume` varchar(10) DEFAULT '0.3';--> statement-breakpoint
ALTER TABLE `content_hub_videos` ADD `visualStyle` varchar(30) DEFAULT 'default';--> statement-breakpoint
ALTER TABLE `content_hub_videos` ADD `canvasImageStyle` varchar(30);--> statement-breakpoint
ALTER TABLE `content_hub_videos` ADD `canvasPenStyle` varchar(20);--> statement-breakpoint
ALTER TABLE `content_hub_videos` ADD `logoUrl` text;--> statement-breakpoint
ALTER TABLE `content_hub_videos` ADD `logoPlacement` varchar(5) DEFAULT 'tl';