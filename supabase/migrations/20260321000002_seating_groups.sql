-- Guest groups
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  colour text NOT NULL DEFAULT '#A8B5A2',
  created_at timestamptz DEFAULT now()
);
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON groups FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Link guests to groups
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS group_id uuid REFERENCES groups(id) ON DELETE SET NULL;

-- Group-level rules (separate from individual AVOID/PREFER)
CREATE TABLE IF NOT EXISTS group_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('KEEP_TOGETHER', 'SEPARATE_FROM', 'NEAR_TABLE')),
  group_id uuid NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  target_group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  target_table_id uuid REFERENCES seating_tables(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE group_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all" ON group_rules FOR ALL TO authenticated USING (true) WITH CHECK (true);
