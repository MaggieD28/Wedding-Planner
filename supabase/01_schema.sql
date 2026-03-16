-- ============================================================
-- Wedding Planner — Database Schema
-- Run this in the Supabase SQL Editor (supabase.com/dashboard)
-- ============================================================

-- ─── Settings ───────────────────────────────────────────────
create table if not exists settings (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  value       text not null,
  label       text,
  updated_at  timestamptz not null default now()
);

-- ─── Tasks ──────────────────────────────────────────────────
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  task_id      text not null unique,            -- e.g. T001
  category     text not null,
  name         text not null,
  assigned_to  text,                            -- Maggie | Bobby | Both
  due_date     date,
  status       text default 'Not started',      -- Not started | In progress | Blocked | Done
  priority     text,                            -- High | Medium | Low
  notes        text,
  vendor_id    text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─── Guests ─────────────────────────────────────────────────
create table if not exists guests (
  id                   uuid primary key default gen_random_uuid(),
  guest_id             text not null unique,    -- e.g. G001
  head_guest_id        text,                    -- links to another guest_id
  first_name           text not null,
  last_name            text,
  side                 text not null,           -- Bride | Groom
  email                text,
  phone                text,
  save_the_date_sent   boolean not null default false,
  invite_sent          boolean not null default false,
  invite_date          date,
  rsvp_status          text not null default 'Pending', -- Invited | Accepted | Declined | Pending
  rsvp_date            date,
  dietary_requirement  text,
  allergies_notes      text,
  children_count       integer not null default 0,
  children_dietary     text,
  children_allergies   text,
  follow_up_notes      text,
  table_number         integer,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ─── Vendors ────────────────────────────────────────────────
create table if not exists vendors (
  id                   uuid primary key default gen_random_uuid(),
  vendor_id            text not null unique,    -- e.g. V001
  vendor_name          text not null,
  category             text not null,
  contact_name         text,
  email                text,
  phone                text,
  contract_signed      boolean not null default false,
  contract_value_eur   numeric(10,2) not null default 0,
  notes                text,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

-- ─── Budget Items ────────────────────────────────────────────
create table if not exists budget_items (
  id                    uuid primary key default gen_random_uuid(),
  budget_item_id        text not null unique,   -- e.g. B001
  category              text not null,
  description           text not null,
  vendor_id             text,
  units                 numeric(10,2) not null default 1,
  price_per_unit_eur    numeric(10,2) not null default 0,
  actual_invoiced_eur   numeric(10,2) not null default 0,
  actual_paid_eur       numeric(10,2) not null default 0,
  active                boolean not null default true,
  notes                 text,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ─── Invoices ────────────────────────────────────────────────
create table if not exists invoices (
  id              uuid primary key default gen_random_uuid(),
  invoice_id      text not null unique,         -- e.g. I001
  vendor_id       text,
  budget_item_id  text,
  description     text not null,
  amount_eur      numeric(10,2) not null default 0,
  invoice_date    date,
  due_date        date,
  paid            boolean not null default false,
  paid_date       date,
  paid_by         text,                         -- Maggie | Bobby
  payment_method  text,
  notes           text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─── Decisions Log ───────────────────────────────────────────
create table if not exists decisions (
  id                  uuid primary key default gen_random_uuid(),
  decision_id         text not null unique,     -- e.g. D001
  date                date,
  what_was_decided    text not null,
  options_considered  text,
  rationale           text,
  owner               text,                     -- Maggie | Bobby | Both
  locked              boolean not null default false,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ─── Row Level Security ──────────────────────────────────────
-- All tables: only authenticated users can read/write
alter table settings   enable row level security;
alter table tasks      enable row level security;
alter table guests     enable row level security;
alter table vendors    enable row level security;
alter table budget_items enable row level security;
alter table invoices   enable row level security;
alter table decisions  enable row level security;

-- Policy: any authenticated user can do everything
create policy "Authenticated users have full access" on settings
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users have full access" on tasks
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users have full access" on guests
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users have full access" on vendors
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users have full access" on budget_items
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users have full access" on invoices
  for all using (auth.role() = 'authenticated');

create policy "Authenticated users have full access" on decisions
  for all using (auth.role() = 'authenticated');

-- ─── Auto-update updated_at ──────────────────────────────────
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tasks_updated_at      before update on tasks      for each row execute function update_updated_at();
create trigger guests_updated_at     before update on guests     for each row execute function update_updated_at();
create trigger vendors_updated_at    before update on vendors    for each row execute function update_updated_at();
create trigger budget_items_updated_at before update on budget_items for each row execute function update_updated_at();
create trigger invoices_updated_at   before update on invoices   for each row execute function update_updated_at();
create trigger decisions_updated_at  before update on decisions  for each row execute function update_updated_at();
create trigger settings_updated_at   before update on settings   for each row execute function update_updated_at();

-- ─── Realtime ────────────────────────────────────────────────
-- Enable realtime on all tables (run in Supabase dashboard under Database > Replication,
-- or uncomment the lines below if your Supabase instance supports it via SQL)
-- alter publication supabase_realtime add table tasks;
-- alter publication supabase_realtime add table guests;
-- alter publication supabase_realtime add table budget_items;
-- alter publication supabase_realtime add table invoices;
-- alter publication supabase_realtime add table decisions;
-- alter publication supabase_realtime add table settings;
