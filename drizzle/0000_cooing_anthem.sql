CREATE TABLE `archive_entries` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`entry_date` text,
	`location` text,
	`excerpt` text,
	`story` text,
	`media_url` text,
	`metadata` text,
	`tags` text,
	`featured` integer DEFAULT false NOT NULL,
	`featured_order` integer,
	`visibility` text DEFAULT 'guests' NOT NULL,
	`published` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `archive_slug_unique` ON `archive_entries` (`slug`);--> statement-breakpoint
CREATE INDEX `archive_featured_idx` ON `archive_entries` (`featured`,`featured_order`);--> statement-breakpoint
CREATE TABLE `gift_reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`gift_id` text NOT NULL,
	`guest_id` text NOT NULL,
	`surprise` integer DEFAULT true NOT NULL,
	`status` text DEFAULT 'reserved' NOT NULL,
	`reserved_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`released_at` text,
	`purchased_at` text,
	FOREIGN KEY (`gift_id`) REFERENCES `gifts`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `gifts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`recipient_category` text NOT NULL,
	`image_url` text,
	`purchase_url` text,
	`price_label` text,
	`status` text DEFAULT 'available' NOT NULL,
	`reserved_by_guest_id` text,
	`reserved_at` text,
	`purchased_at` text,
	`shipping_required` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`reserved_by_guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `gifts_category_idx` ON `gifts` (`recipient_category`);--> statement-breakpoint
CREATE INDEX `gifts_status_idx` ON `gifts` (`status`);--> statement-breakpoint
CREATE TABLE `guest_marks` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`author_name` text NOT NULL,
	`message` text,
	`drawing_key` text,
	`visibility` text DEFAULT 'private' NOT NULL,
	`moderation_status` text DEFAULT 'pending' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `marks_moderation_idx` ON `guest_marks` (`moderation_status`,`visibility`);--> statement-breakpoint
CREATE INDEX `marks_guest_idx` ON `guest_marks` (`guest_id`);--> statement-breakpoint
CREATE TABLE `guests` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`display_name` text NOT NULL,
	`email` text,
	`party_limit` integer DEFAULT 1 NOT NULL,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `guests_token_hash_unique` ON `guests` (`token_hash`);--> statement-breakpoint
CREATE TABLE `rsvps` (
	`id` text PRIMARY KEY NOT NULL,
	`guest_id` text NOT NULL,
	`attendance` text NOT NULL,
	`party_size` integer DEFAULT 1 NOT NULL,
	`guest_names` text,
	`dietary` text,
	`message` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rsvps_guest_unique` ON `rsvps` (`guest_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
