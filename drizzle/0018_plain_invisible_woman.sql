ALTER TABLE `webinar_registrants` ADD `confirmationSmsSent` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `webinar_registrants` ADD `confirmationSmsAt` timestamp;