ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS rsvp_synced boolean NOT NULL DEFAULT false;
