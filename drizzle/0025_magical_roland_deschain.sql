CREATE TABLE `llc_state_pricing` (
	`id` int AUTO_INCREMENT NOT NULL,
	`state` varchar(2) NOT NULL,
	`retailPriceCents` int,
	`stateFeeCents` int NOT NULL,
	`active` boolean NOT NULL DEFAULT true,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `llc_state_pricing_id` PRIMARY KEY(`id`),
	CONSTRAINT `llc_state_pricing_state_unique` UNIQUE(`state`)
);
