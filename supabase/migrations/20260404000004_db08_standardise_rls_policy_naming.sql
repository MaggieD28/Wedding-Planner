-- DB-08: Standardise RLS policy naming
-- All policies renamed to 'authenticated_full_access', bound to 'authenticated' role

-- Drop all existing public-schema policies
DROP POLICY IF EXISTS "Authenticated users have full access" ON budget_items;
DROP POLICY IF EXISTS "Authenticated users have full access" ON decisions;
DROP POLICY IF EXISTS "auth_all"                             ON group_rules;
DROP POLICY IF EXISTS "auth_all"                             ON groups;
DROP POLICY IF EXISTS "Authenticated users have full access" ON guests;
DROP POLICY IF EXISTS "Authenticated users have full access" ON invoices;
DROP POLICY IF EXISTS "auth full access"                     ON room_config;
DROP POLICY IF EXISTS "auth full access"                     ON seating_constraints;
DROP POLICY IF EXISTS "auth full access"                     ON seating_tables;
DROP POLICY IF EXISTS "auth full access"                     ON seats;
DROP POLICY IF EXISTS "Authenticated users have full access" ON settings;
DROP POLICY IF EXISTS "Authenticated users have full access" ON tasks;
DROP POLICY IF EXISTS "Authenticated users have full access" ON vendors;

-- Recreate consistently: name = authenticated_full_access, role = authenticated
CREATE POLICY authenticated_full_access ON budget_items        FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON decisions           FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON group_rules         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON groups              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON guests              FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON invoices            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON room_config         FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON seating_constraints FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON seating_tables      FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON seats               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON settings            FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON tasks               FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY authenticated_full_access ON vendors             FOR ALL TO authenticated USING (true) WITH CHECK (true);
