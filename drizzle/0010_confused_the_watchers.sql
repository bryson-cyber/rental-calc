CREATE TABLE `content_hub_presets` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`emoji` varchar(10) DEFAULT '⚡',
	`format` varchar(50),
	`voiceStyle` varchar(50),
	`contentFocus` varchar(50),
	`contentLength` varchar(50),
	`storyFormat` varchar(50),
	`persona` varchar(50) DEFAULT 'coach-inayah',
	`bgMusic` varchar(50) DEFAULT 'engaging',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `content_hub_presets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `content_hub_videos` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`topic` text NOT NULL,
	`format` varchar(50) NOT NULL,
	`timing` varchar(10) NOT NULL DEFAULT 'auto',
	`voiceStyle` varchar(50),
	`contentFocus` varchar(50),
	`contentLength` varchar(50),
	`storyFormat` varchar(50),
	`persona` varchar(50) DEFAULT 'coach-inayah',
	`bgMusic` varchar(50) DEFAULT 'engaging',
	`ttsStyle` varchar(50) DEFAULT 'solo-female',
	`realTimeFacts` text,
	`sources` json,
	`searchQueries` json,
	`narrationScript` text,
	`successStoryUsed` text,
	`videoUrl` text,
	`videoId` varchar(255),
	`golpoJobId` varchar(100),
	`thumbnailUrl` text,
	`status` enum('pipeline_queued','researching','scripting','script_review','script_only','video_generating','video_complete','video_failed','pipeline_failed') NOT NULL DEFAULT 'pipeline_queued',
	`pipelineStage` varchar(200),
	`error` text,
	`layer1DurationMs` int,
	`layer2DurationMs` int,
	`layer3DurationMs` int,
	`totalDurationMs` int,
	`modelsUsed` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `content_hub_videos_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `chp_user_idx` ON `content_hub_presets` (`userId`);--> statement-breakpoint
CREATE INDEX `chv_user_idx` ON `content_hub_videos` (`userId`);--> statement-breakpoint
CREATE INDEX `chv_status_idx` ON `content_hub_videos` (`status`);--> statement-breakpoint
CREATE INDEX `chv_format_idx` ON `content_hub_videos` (`format`);--> statement-breakpoint
CREATE INDEX `chv_created_idx` ON `content_hub_videos` (`createdAt`);