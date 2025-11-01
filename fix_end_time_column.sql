-- Usuń ograniczenie NOT NULL z kolumny end_time
ALTER TABLE downtimes ALTER COLUMN end_time DROP NOT NULL;