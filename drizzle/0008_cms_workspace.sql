ALTER TABLE guests ADD COLUMN invitation_token_enc TEXT;
CREATE TABLE page_visits (
  id TEXT PRIMARY KEY NOT NULL,
  guest_id TEXT REFERENCES guests(id) ON DELETE CASCADE,
  session_hash TEXT NOT NULL,
  page TEXT NOT NULL CHECK(page IN ('home','invitation','gifts','archive','postcard')),
  views INTEGER NOT NULL DEFAULT 1,
  first_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX page_visits_guest_idx ON page_visits(guest_id,last_at);
CREATE INDEX page_visits_last_idx ON page_visits(last_at);
