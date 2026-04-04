-- DB-04: Add indexes on heavily-queried columns

CREATE INDEX idx_guests_rsvp_status ON guests(rsvp_status);
CREATE INDEX idx_guests_group_id    ON guests(group_id);
CREATE INDEX idx_tasks_status       ON tasks(status);
CREATE INDEX idx_tasks_due_date     ON tasks(due_date);
CREATE INDEX idx_tasks_assigned_to  ON tasks(assigned_to);
CREATE INDEX idx_seats_guest_id     ON seats(guest_id);
CREATE INDEX idx_seats_table_id     ON seats(table_id);
CREATE INDEX idx_invoices_vendor_id ON invoices(vendor_id);
