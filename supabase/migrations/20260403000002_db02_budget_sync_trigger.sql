-- DB-02: Auto-sync budget_items totals from invoices via trigger

CREATE OR REPLACE FUNCTION sync_budget_item_totals()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  v_budget_item_id UUID;
BEGIN
  v_budget_item_id := COALESCE(NEW.budget_item_id, OLD.budget_item_id);
  IF v_budget_item_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  UPDATE budget_items SET
    actual_invoiced_eur = COALESCE((
      SELECT SUM(amount_eur) FROM invoices
      WHERE budget_item_id = v_budget_item_id
    ), 0),
    actual_paid_eur = COALESCE((
      SELECT SUM(amount_eur) FROM invoices
      WHERE budget_item_id = v_budget_item_id AND paid = true
    ), 0)
  WHERE id = v_budget_item_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER sync_budget_totals
AFTER INSERT OR UPDATE OR DELETE ON invoices
FOR EACH ROW EXECUTE FUNCTION sync_budget_item_totals();

-- Backfill existing data so current totals are immediately correct
UPDATE budget_items bi SET
  actual_invoiced_eur = COALESCE((
    SELECT SUM(amount_eur) FROM invoices WHERE budget_item_id = bi.id
  ), 0),
  actual_paid_eur = COALESCE((
    SELECT SUM(amount_eur) FROM invoices WHERE budget_item_id = bi.id AND paid = true
  ), 0);
