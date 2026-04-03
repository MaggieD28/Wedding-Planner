-- DB-07: Add missing columns for planned features

-- Guests: postal address, wedding party role, gift tracking
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS wedding_role TEXT CHECK (wedding_role IN (
    'Bridesmaid','Groomsman','Best Man','Maid of Honour',
    'Usher','Flower Girl','Ring Bearer','Other'
  )),
  ADD COLUMN IF NOT EXISTS gift_received BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS thank_you_sent BOOLEAN NOT NULL DEFAULT false;

-- Decisions: category tag
ALTER TABLE decisions
  ADD COLUMN IF NOT EXISTS category TEXT;

-- Vendors: website and address
ALTER TABLE vendors
  ADD COLUMN IF NOT EXISTS website TEXT,
  ADD COLUMN IF NOT EXISTS address TEXT;

-- Settings: total budget envelope
INSERT INTO settings (key, value, label)
VALUES ('total_budget_eur', '0', 'Total Wedding Budget (EUR)')
ON CONFLICT (key) DO NOTHING;
