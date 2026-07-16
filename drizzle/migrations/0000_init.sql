-- aspoem D1 baseline schema (对齐 src/server/db/schema.ts)
-- 时间戳存 unix 秒 (integer)，布尔存 0/1，JSON 存 text

CREATE TABLE `dynasties` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`pinyin` text NOT NULL,
	`slug` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `dynasties_slug_unique` ON `dynasties` (`slug`);
--> statement-breakpoint
CREATE TABLE `authors` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`pinyin` text NOT NULL,
	`slug` text NOT NULL,
	`birthDate` integer,
	`deathDate` integer,
	`introduce` text,
	`epithets` text DEFAULT '[]' NOT NULL,
	`style` text,
	`visits` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`dynastyId` text NOT NULL,
	FOREIGN KEY (`dynastyId`) REFERENCES `dynasties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `authors_slug_unique` ON `authors` (`slug`);
--> statement-breakpoint
CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`visits` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tags_slug_unique` ON `tags` (`slug`);
--> statement-breakpoint
CREATE TABLE `poems` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`titleSlug` text NOT NULL,
	`titlePinyin` text NOT NULL,
	`paragraphs` text DEFAULT '[]' NOT NULL,
	`paragraphsPinyin` text DEFAULT '[]' NOT NULL,
	`annotation` text,
	`translation` text DEFAULT '' NOT NULL,
	`appreciation` text DEFAULT '' NOT NULL,
	`isOrderliness` integer DEFAULT 0 NOT NULL,
	`searchText` text,
	`visits` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`authorId` text NOT NULL,
	`dynastyId` text,
	FOREIGN KEY (`authorId`) REFERENCES `authors`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`dynastyId`) REFERENCES `dynasties`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `poems_slug_unique` ON `poems` (`slug`);
--> statement-breakpoint
CREATE INDEX `poems_updatedAt_visits_idx` ON `poems` (`updatedAt`,`visits`);
--> statement-breakpoint
CREATE TABLE `poems_to_tags` (
	`poemId` text NOT NULL,
	`tagId` text NOT NULL,
	PRIMARY KEY(`poemId`, `tagId`),
	FOREIGN KEY (`poemId`) REFERENCES `poems`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer DEFAULT 0 NOT NULL,
	`image` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`role` text,
	`banned` integer DEFAULT 0,
	`banReason` text,
	`banExpires` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	`impersonatedBy` text,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer DEFAULT (unixepoch()) NOT NULL,
	`updatedAt` integer DEFAULT (unixepoch()) NOT NULL
);
