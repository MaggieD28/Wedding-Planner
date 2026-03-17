-- Add head table flag to existing guests
ALTER TABLE guests ADD COLUMN IF NOT EXISTS is_head_table boolean DEFAULT false;

-- Wedding reception tables
CREATE TABLE seating_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  capacity int NOT NULL DEFAULT 10,
  x float,
  y float,
  shape text DEFAULT 'CIRCLE',  -- CIRCLE | OVAL | RECTANGLE
  is_head_table boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Individual seats (created automatically when a table is created)
CREATE TABLE seats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES seating_tables(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL
);

-- Seating constraints
CREATE TABLE seating_constraints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_a_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  guest_b_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  type text NOT NULL,  -- AVOID | PREFER
  created_at timestamptz DEFAULT now(),
  UNIQUE(guest_a_id, guest_b_id)
);

-- Single-row room config
CREATE TABLE room_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_shape text DEFAULT 'RECTANGLE',
  aspect_ratio float DEFAULT 1.5,
  table_shape text DEFAULT 'CIRCLE',
  seats_per_table int DEFAULT 10,
  updated_at timestamptz DEFAULT now()
);

-- RLS: authenticated users have full access
ALTER TABLE seating_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
ALTER TABLE seating_constraints ENABLE ROW LEVEL SECURITY;
ALTER TABLE room_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth full access" ON seating_tables FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth full access" ON seats FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth full access" ON seating_constraints FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "auth full access" ON room_config FOR ALL USING (auth.role() = 'authenticated');
