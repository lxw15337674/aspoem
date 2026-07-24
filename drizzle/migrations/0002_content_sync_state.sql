CREATE TABLE `content_sync_state` (
	`source` text PRIMARY KEY NOT NULL,
	`revision` text NOT NULL,
	`syncedAt` integer DEFAULT (unixepoch()) NOT NULL,
	`details` text NOT NULL
);
