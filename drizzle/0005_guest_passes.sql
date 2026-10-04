CREATE TABLE IF NOT EXISTS guest_passes (
  id TEXT PRIMARY KEY NOT NULL,
  guest_id TEXT NOT NULL REFERENCES guests(id),
  token_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS guest_passes_guest_unique ON guest_passes(guest_id);
CREATE TABLE IF NOT EXISTS guest_checkins (
  guest_id TEXT PRIMARY KEY NOT NULL REFERENCES guests(id),
  pass_id TEXT NOT NULL,
  party_size INTEGER NOT NULL CHECK(party_size BETWEEN 1 AND 20),
  checked_in_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  checked_in_by TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS gift_reservations_one_active ON gift_reservations(gift_id) WHERE status IN ('reserved', 'purchased');
