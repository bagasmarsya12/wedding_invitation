CREATE TABLE staff_users (
  id TEXT PRIMARY KEY NOT NULL,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  credential TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE staff_sessions (
  token_hash TEXT PRIMARY KEY NOT NULL,
  staff_id TEXT NOT NULL REFERENCES staff_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL
);
CREATE INDEX staff_sessions_staff_idx ON staff_sessions(staff_id);
CREATE INDEX staff_sessions_expiry_idx ON staff_sessions(expires_at);
ALTER TABLE guest_checkins ADD COLUMN checkin_method TEXT NOT NULL DEFAULT 'qr' CHECK(checkin_method IN ('qr', 'name'));
