CREATE INDEX `authors_name_id_idx` ON `authors` (`name`,`id`);
--> statement-breakpoint
CREATE INDEX `poems_authorId_createdAt_id_idx` ON `poems` (`authorId`,`createdAt`,`id`);
--> statement-breakpoint
CREATE INDEX `poems_updatedAt_id_idx` ON `poems` (`updatedAt`,`id`);
--> statement-breakpoint
CREATE INDEX `poems_visits_id_idx` ON `poems` (`visits`,`id`);
--> statement-breakpoint
CREATE INDEX `poems_dynastyId_createdAt_id_idx` ON `poems` (`dynastyId`,`createdAt`,`id`);
