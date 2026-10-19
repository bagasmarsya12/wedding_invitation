-- Historical visits remain intact and explicitly have unknown device identity.
ALTER TABLE page_visits ADD COLUMN device_hash TEXT;
