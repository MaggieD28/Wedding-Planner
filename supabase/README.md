# Supabase Setup Instructions

## 1. Create your Supabase project
Go to https://supabase.com/dashboard and create a new project.

## 2. Get your credentials
In your Supabase project dashboard, go to **Settings → API** and copy:
- **Project URL** → paste as `NEXT_PUBLIC_SUPABASE_URL` in `.env.local`
- **anon / public key** → paste as `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local`

## 3. Run the schema
In Supabase dashboard → **SQL Editor**, run `01_schema.sql` first, then `02_seed.sql`.

## 4. Enable Realtime
In Supabase dashboard → **Database → Replication**, enable Realtime for these tables:
- tasks
- guests
- budget_items
- invoices
- decisions
- settings

## 5. Create user accounts
In Supabase dashboard → **Authentication → Users**, click "Add user" and create:
- Maggie's account (her email + password)
- Bobby's account (his email + password)

Both will have full access to all data — no roles needed.
