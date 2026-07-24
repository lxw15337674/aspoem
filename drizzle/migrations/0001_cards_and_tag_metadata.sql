ALTER TABLE `tags` ADD COLUMN `type` text;
--> statement-breakpoint
ALTER TABLE `tags` ADD COLUMN `introduce` text;
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` text PRIMARY KEY NOT NULL,
	`content` text NOT NULL,
	`template` text DEFAULT 'ink' NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`poemId` text NOT NULL,
	FOREIGN KEY (`poemId`) REFERENCES `poems`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `cards_poemId_createdAt_idx` ON `cards` (`poemId`,`createdAt`);
