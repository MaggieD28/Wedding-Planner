-- DB-06: Replace guests.table_number with a proper view

CREATE VIEW guest_table_assignments AS
  SELECT s.guest_id, st.name AS table_name, st.id AS table_id
  FROM seats s
  JOIN seating_tables st ON s.table_id = st.id
  WHERE s.guest_id IS NOT NULL;

ALTER TABLE guests DROP COLUMN table_number;
