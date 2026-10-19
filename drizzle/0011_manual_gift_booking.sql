ALTER TABLE gifts ADD COLUMN booking_name TEXT;
ALTER TABLE gifts ADD COLUMN booking_anonymous INTEGER NOT NULL DEFAULT 0 CHECK(booking_anonymous IN (0,1));
