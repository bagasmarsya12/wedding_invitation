ALTER TABLE `guests` ADD `import_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `guests_import_key_unique` ON `guests` (`import_key`);