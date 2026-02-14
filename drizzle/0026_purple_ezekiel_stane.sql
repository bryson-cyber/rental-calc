CREATE TABLE `video_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`jobId` varchar(64) NOT NULL,
	`golpoJobId` varchar(128),
	`scriptId` int NOT NULL,
	`title` varchar(500) NOT NULL,
	`status` enum('pending','generating','completed','failed') NOT NULL DEFAULT 'pending',
	`videoUrl` text,
	`videoScript` text,
	`error` text,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `video_jobs_id` PRIMARY KEY(`id`),
	CONSTRAINT `video_jobs_jobId_unique` UNIQUE(`jobId`)
);
--> statement-breakpoint
CREATE INDEX `vj_job_id_idx` ON `video_jobs` (`jobId`);--> statement-breakpoint
CREATE INDEX `vj_golpo_job_id_idx` ON `video_jobs` (`golpoJobId`);--> statement-breakpoint
CREATE INDEX `vj_script_id_idx` ON `video_jobs` (`scriptId`);--> statement-breakpoint
CREATE INDEX `vj_status_idx` ON `video_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `vj_created_idx` ON `video_jobs` (`createdAt`);