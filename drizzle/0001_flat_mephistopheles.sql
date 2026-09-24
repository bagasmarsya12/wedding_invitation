CREATE TABLE `mutation_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`window_start` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `gift_reservations_one_active_per_gift` ON `gift_reservations` (`gift_id`) WHERE `status` = 'reserved';
--> statement-breakpoint
CREATE INDEX `archive_public_feed_idx` ON `archive_entries` (`published`, `visibility`, `featured`, `featured_order`);
--> statement-breakpoint
CREATE TRIGGER `guest_marks_active_limit_insert` BEFORE INSERT ON `guest_marks`
WHEN NEW.moderation_status IN ('pending', 'approved') AND
  (SELECT COUNT(*) FROM guest_marks WHERE guest_id = NEW.guest_id AND moderation_status IN ('pending', 'approved')) >= 3
BEGIN SELECT RAISE(ABORT, 'active mark limit'); END;
--> statement-breakpoint
CREATE TRIGGER `guest_marks_active_limit_update` BEFORE UPDATE OF moderation_status ON `guest_marks`
WHEN NEW.moderation_status IN ('pending', 'approved') AND OLD.moderation_status NOT IN ('pending', 'approved') AND
  (SELECT COUNT(*) FROM guest_marks WHERE guest_id = NEW.guest_id AND moderation_status IN ('pending', 'approved')) >= 3
BEGIN SELECT RAISE(ABORT, 'active mark limit'); END;
