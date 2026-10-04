ALTER TABLE guests ADD COLUMN guest_group TEXT NOT NULL DEFAULT 'unassigned' CHECK(guest_group IN ('unassigned', 'bagas', 'iga', 'family', 'other'));
ALTER TABLE guests ADD COLUMN invitation_sent_at TEXT;
ALTER TABLE gifts ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
ALTER TABLE gifts ADD COLUMN published INTEGER NOT NULL DEFAULT 1 CHECK(published IN (0, 1));
WITH ordered AS (SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) - 1 AS position FROM gifts)
UPDATE gifts SET sort_order = (SELECT position FROM ordered WHERE ordered.id = gifts.id);
CREATE TABLE gift_media (
  gift_id TEXT PRIMARY KEY NOT NULL REFERENCES gifts(id),
  object_key TEXT NOT NULL,
  content_type TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
