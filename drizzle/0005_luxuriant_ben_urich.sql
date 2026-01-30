CREATE TABLE `comment_votes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`commentId` int NOT NULL,
	`userId` int NOT NULL,
	`voteType` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `comment_votes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `regulation_comments` ADD `upvotes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `regulation_comments` ADD `downvotes` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `regulation_comments` ADD `isFlagged` int DEFAULT 0 NOT NULL;