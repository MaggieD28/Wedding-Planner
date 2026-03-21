-- =============================================================================
-- BASELINE MIGRATION — captured from live database on 2026-03-21
-- This file represents the full schema as it exists in production.
-- All subsequent schema changes should be made as new migration files.
-- =============================================================================

-- -------------------------
-- SETTINGS
-- -------------------------
CREATE TABLE IF NOT EXISTS settings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL,
  value      text NOT NULL,
  label      text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_key_key UNIQUE (key)
);

ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users have full access" ON settings
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- -------------------------
-- GUESTS
-- -------------------------
CREATE TABLE IF NOT EXISTS guests (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_id             text NOT NULL,
  head_guest_id        text,
  first_name           text NOT NULL,
  last_name            text,
  side                 text NOT NULL,
  email                text,
  phone                text,
  save_the_date_sent   boolean NOT NULL DEFAULT false,
  invite_sent          boolean NOT NULL DEFAULT false,
  invite_date          date,
  rsvp_status          text NOT NULL DEFAULT 'Pending',
  rsvp_date            date,
  dietary_requirement  text,
  allergies_notes      text,
  children_count       integer NOT NULL DEFAULT 0,
  children_dietary     text,
  children_allergies   text,
  follow_up_notes      text,
  table_number         integer,
  is_head_table        boolean DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT guests_guest_id_key UNIQUE (guest_id)
);

ALTER TABLE guests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users have full access" ON guests
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- -------------------------
-- VENDORS
-- -------------------------
CREATE TABLE IF NOT EXISTS vendors (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id          text NOT NULL,
  vendor_name        text NOT NULL,
  category           text NOT NULL,
  contact_name       text,
  email              text,
  phone              text,
  contract_signed    boolean NOT NULL DEFAULT false,
  contract_value_eur numeric NOT NULL DEFAULT 0,
  notes              text,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT vendors_vendor_id_key UNIQUE (vendor_id)
);

ALTER TABLE vendors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users have full access" ON vendors
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- -------------------------
-- BUDGET ITEMS
-- -------------------------
CREATE TABLE IF NOT EXISTS budget_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_item_id      text NOT NULL,
  category            text NOT NULL,
  description         text NOT NULL,
  vendor_id           text,
  units               numeric NOT NULL DEFAULT 1,
  price_per_unit_eur  numeric NOT NULL DEFAULT 0,
  actual_invoiced_eur numeric NOT NULL DEFAULT 0,
  actual_paid_eur     numeric NOT NULL DEFAULT 0,
  active              boolean NOT NULL DEFAULT true,
  notes               text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT budget_items_budget_item_id_key UNIQUE (budget_item_id)
);

ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users have full access" ON budget_items
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- -------------------------
-- INVOICES
-- -------------------------
CREATE TABLE IF NOT EXISTS invoices (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id     text NOT NULL,
  vendor_id      text,
  budget_item_id text,
  description    text NOT NULL,
  amount_eur     numeric NOT NULL DEFAULT 0,
  invoice_date   date,
  due_date       date,
  paid           boolean NOT NULL DEFAULT false,
  paid_date      date,
  paid_by        text,
  payment_method text,
  notes          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT invoices_invoice_id_key UNIQUE (invoice_id)
);

ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users have full access" ON invoices
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- -------------------------
-- TASKS
-- -------------------------
CREATE TABLE IF NOT EXISTS tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     text NOT NULL,
  category    text NOT NULL,
  name        text NOT NULL,
  assigned_to text,
  due_date    date,
  status      text DEFAULT 'Not started',
  priority    text,
  notes       text,
  vendor_id   text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT tasks_task_id_key UNIQUE (task_id)
);

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users have full access" ON tasks
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- -------------------------
-- DECISIONS
-- -------------------------
CREATE TABLE IF NOT EXISTS decisions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  decision_id       text NOT NULL,
  date              date,
  what_was_decided  text NOT NULL,
  options_considered text,
  rationale         text,
  owner             text,
  locked            boolean NOT NULL DEFAULT false,
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT decisions_decision_id_key UNIQUE (decision_id)
);

ALTER TABLE decisions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users have full access" ON decisions
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- -------------------------
-- SEATING TABLES
-- -------------------------
CREATE TABLE IF NOT EXISTS seating_tables (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name         text NOT NULL,
  capacity     integer NOT NULL DEFAULT 10,
  x            double precision,
  y            double precision,
  shape        text DEFAULT 'CIRCLE',
  is_head_table boolean DEFAULT false,
  created_at   timestamptz DEFAULT now()
);

ALTER TABLE seating_tables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON seating_tables
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- -------------------------
-- SEATS
-- -------------------------
CREATE TABLE IF NOT EXISTS seats (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid NOT NULL REFERENCES seating_tables(id) ON DELETE CASCADE,
  guest_id uuid REFERENCES guests(id) ON DELETE SET NULL
);

ALTER TABLE seats ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON seats
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- -------------------------
-- SEATING CONSTRAINTS
-- -------------------------
CREATE TABLE IF NOT EXISTS seating_constraints (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  guest_a_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  guest_b_id uuid NOT NULL REFERENCES guests(id) ON DELETE CASCADE,
  type       text NOT NULL,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT seating_constraints_guest_a_id_guest_b_id_key UNIQUE (guest_a_id, guest_b_id)
);

ALTER TABLE seating_constraints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON seating_constraints
  FOR ALL TO public USING (auth.role() = 'authenticated');

-- -------------------------
-- ROOM CONFIG
-- -------------------------
CREATE TABLE IF NOT EXISTS room_config (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_shape     text DEFAULT 'RECTANGLE',
  aspect_ratio   double precision DEFAULT 1.5,
  table_shape    text DEFAULT 'CIRCLE',
  seats_per_table integer DEFAULT 10,
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE room_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth full access" ON room_config
  FOR ALL TO public USING (auth.role() = 'authenticated');
