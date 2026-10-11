CREATE TABLE photo_comments (
  id TEXT PRIMARY KEY NOT NULL,
  photo_key TEXT NOT NULL,
  parent_id TEXT REFERENCES photo_comments(id),
  guest_id TEXT REFERENCES guests(id),
  author_kind TEXT NOT NULL CHECK(author_kind IN ('guest','couple')),
  author_name TEXT NOT NULL,
  message TEXT NOT NULL CHECK(length(trim(message)) BETWEEN 1 AND 600),
  moderation_status TEXT NOT NULL DEFAULT 'pending' CHECK(moderation_status IN ('pending','approved','hidden')),
  removed_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK((author_kind='guest' AND guest_id IS NOT NULL) OR (author_kind='couple' AND guest_id IS NULL))
);
--> statement-breakpoint
CREATE INDEX photo_comments_thread_idx ON photo_comments(photo_key,parent_id,moderation_status,created_at,id);
--> statement-breakpoint
CREATE INDEX photo_comments_moderation_idx ON photo_comments(moderation_status,created_at,id);
--> statement-breakpoint
CREATE TRIGGER photo_comments_reply_guard BEFORE INSERT ON photo_comments WHEN NEW.parent_id IS NOT NULL
BEGIN
  SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM photo_comments p WHERE p.id=NEW.parent_id AND p.photo_key=NEW.photo_key AND p.parent_id IS NULL AND p.moderation_status='approved' AND p.removed_at IS NULL)
    THEN RAISE(ABORT,'Reply requires an approved root on the same photo') END;
END;
--> statement-breakpoint
CREATE TABLE photo_comment_hearts (
  comment_id TEXT NOT NULL REFERENCES photo_comments(id) ON DELETE CASCADE,
  guest_id TEXT NOT NULL REFERENCES guests(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY(comment_id,guest_id)
);
--> statement-breakpoint
CREATE TABLE photo_comment_settings (
  photo_key TEXT PRIMARY KEY NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
