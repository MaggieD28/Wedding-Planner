-- CQ-04: Auto-generate decision_id via sequence to eliminate client-side race condition

CREATE SEQUENCE IF NOT EXISTS decisions_decision_id_seq START 1;

-- Seed sequence from current max (safe no-op if table is empty)
SELECT setval(
  'decisions_decision_id_seq',
  COALESCE(MAX(NULLIF(regexp_replace(decision_id, '\D', '', 'g'), '')::int), 0) + 1,
  false
)
FROM decisions;

CREATE OR REPLACE FUNCTION set_decision_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.decision_id IS NULL OR NEW.decision_id = '' THEN
    NEW.decision_id := 'D' || lpad(nextval('decisions_decision_id_seq')::text, 3, '0');
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER decisions_set_decision_id
  BEFORE INSERT ON decisions
  FOR EACH ROW EXECUTE FUNCTION set_decision_id();
