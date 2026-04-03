-- DB-01: Migrate text FK references to proper UUID foreign keys
-- Strategy: add UUID column → backfill via JOIN → drop old text column → rename

-- ── budget_items.vendor_id ───────────────────────────────────────────────────
ALTER TABLE budget_items
  ADD COLUMN IF NOT EXISTS vendor_uuid UUID REFERENCES vendors(id) ON DELETE SET NULL;

UPDATE budget_items bi
  SET vendor_uuid = v.id
  FROM vendors v
  WHERE v.vendor_id = bi.vendor_id AND bi.vendor_id IS NOT NULL;

ALTER TABLE budget_items DROP COLUMN vendor_id;
ALTER TABLE budget_items RENAME COLUMN vendor_uuid TO vendor_id;

-- ── tasks.vendor_id ──────────────────────────────────────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS vendor_uuid UUID REFERENCES vendors(id) ON DELETE SET NULL;

UPDATE tasks t
  SET vendor_uuid = v.id
  FROM vendors v
  WHERE v.vendor_id = t.vendor_id AND t.vendor_id IS NOT NULL;

ALTER TABLE tasks DROP COLUMN vendor_id;
ALTER TABLE tasks RENAME COLUMN vendor_uuid TO vendor_id;

-- ── invoices.vendor_id ───────────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS vendor_uuid UUID REFERENCES vendors(id) ON DELETE SET NULL;

UPDATE invoices i
  SET vendor_uuid = v.id
  FROM vendors v
  WHERE v.vendor_id = i.vendor_id AND i.vendor_id IS NOT NULL;

ALTER TABLE invoices DROP COLUMN vendor_id;
ALTER TABLE invoices RENAME COLUMN vendor_uuid TO vendor_id;

-- ── invoices.budget_item_id ──────────────────────────────────────────────────
ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS budget_item_uuid UUID REFERENCES budget_items(id) ON DELETE SET NULL;

UPDATE invoices i
  SET budget_item_uuid = b.id
  FROM budget_items b
  WHERE b.budget_item_id = i.budget_item_id AND i.budget_item_id IS NOT NULL;

ALTER TABLE invoices DROP COLUMN budget_item_id;
ALTER TABLE invoices RENAME COLUMN budget_item_uuid TO budget_item_id;

-- ── guests.head_guest_id ─────────────────────────────────────────────────────
-- Two cases in production:
--   Case 1: RSVP sync already wrote UUIDs (matched.id) — handle with regex check
--   Case 2: Manual form entries wrote text business keys like "G001"
ALTER TABLE guests
  ADD COLUMN IF NOT EXISTS head_guest_uuid UUID REFERENCES guests(id) ON DELETE SET NULL;

-- Case 1: value is already a valid UUID
UPDATE guests
  SET head_guest_uuid = head_guest_id::uuid
  WHERE head_guest_id IS NOT NULL
    AND head_guest_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Case 2: value is a text business key like "G001"
UPDATE guests g
  SET head_guest_uuid = hg.id
  FROM guests hg
  WHERE hg.guest_id = g.head_guest_id
    AND g.head_guest_id IS NOT NULL
    AND g.head_guest_uuid IS NULL;

ALTER TABLE guests DROP COLUMN head_guest_id;
ALTER TABLE guests RENAME COLUMN head_guest_uuid TO head_guest_id;
