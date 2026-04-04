-- DB-05: Add updated_at / created_at to seating tables

ALTER TABLE seating_tables      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE seating_constraints ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE groups              ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE group_rules         ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE seats               ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE seats               ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

CREATE TRIGGER seating_tables_updated_at
  BEFORE UPDATE ON seating_tables
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER seating_constraints_updated_at
  BEFORE UPDATE ON seating_constraints
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER group_rules_updated_at
  BEFORE UPDATE ON group_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER seats_updated_at
  BEFORE UPDATE ON seats
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
