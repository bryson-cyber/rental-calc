ALTER TABLE `webinar_registrants` ADD `calendarInviteSent` int DEFAULT 0;--> statement-breakpoint
ALTER TABLE `webinar_registrants` ADD `calendarEventId` varchar(255);