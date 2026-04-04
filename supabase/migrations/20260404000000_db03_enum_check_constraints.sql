-- DB-03: Add CHECK constraints for all enum columns

ALTER TABLE guests
  ADD CONSTRAINT chk_rsvp_status CHECK (rsvp_status IN ('Invited','Accepted','Declined','Pending')),
  ADD CONSTRAINT chk_side CHECK (side IN ('Bride','Groom'));

ALTER TABLE tasks
  ADD CONSTRAINT chk_task_status CHECK (status IN ('Not started','In progress','Blocked','Done')),
  ADD CONSTRAINT chk_priority CHECK (priority IN ('High','Medium','Low')),
  ADD CONSTRAINT chk_assigned_to CHECK (assigned_to IN ('Maggie','Bobby','Both'));

ALTER TABLE seating_constraints
  ADD CONSTRAINT chk_constraint_type CHECK (type IN ('AVOID','PREFER'));

ALTER TABLE decisions
  ADD CONSTRAINT chk_owner CHECK (owner IN ('Maggie','Bobby','Both'));

ALTER TABLE seating_tables
  ADD CONSTRAINT chk_shape CHECK (shape IN ('CIRCLE','OVAL','RECTANGLE'));

ALTER TABLE room_config
  ADD CONSTRAINT chk_room_shape CHECK (room_shape IN ('RECTANGLE','SQUARE'));
