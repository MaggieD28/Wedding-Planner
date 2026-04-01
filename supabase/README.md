# Supabase — Setup & Migration Workflow

## Making database changes (the new workflow)

**No more manual SQL editor visits.** All schema changes now go through migration files,
and Claude can apply them directly to the live database.

### To make a schema change:
1. Tell Claude what you want changed (e.g. "add a `plus_one_name` column to the guests table")
2. Claude will create a new migration file in `supabase/migrations/` with a timestamped name
3. Claude applies it to the live database via the Supabase integration
4. Claude updates `01_schema.sql` (the reference copy) and regenerates `types/supabase.ts`

That's it — no dashboard visits needed.

### Migration file naming
Files follow the pattern: `YYYYMMDDHHMMSS_description.sql`
Example: `20260321000000_baseline_schema.sql`

### File map
| File | Purpose |
|------|---------|
| `migrations/` | **Authoritative history** — all schema changes live here |
| `01_schema.sql` | Human-readable reference copy of the full current schema |
| `02_seed.sql` | Initial seed data |
| `03_seating.sql` | (Reference note — seating schema is in migrations) |

---

## First-time project setup (for a fresh Supabase project)

### 1. Create your Supabase project
Go to https://supabase.com/dashboard and create a new project.

### 2. Get your credentials
In **Settings → API**, copy:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
- **anon / public key** → `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`

### 3. Apply the baseline migration
Run `supabase/migrations/20260321000000_baseline_schema.sql` in the SQL Editor.
This creates all 11 tables with RLS policies in one go.

Then run `02_seed.sql` for initial settings data.

### 4. Enable Realtime
In **Database → Replication**, enable Realtime for: tasks, guests, budget_items, invoices, decisions, settings.

### 5. Create user accounts
In **Authentication → Users**, add Maggie and Bobby's accounts.
Both get full access — no roles needed.
