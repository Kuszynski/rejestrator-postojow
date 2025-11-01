-- Dodaj testowy aktywny postój
INSERT INTO downtimes (
  machine_id, 
  operator_id, 
  start_time, 
  duration, 
  comment, 
  date, 
  is_active
) VALUES (
  'm1', 
  'TEST', 
  NOW(), 
  0, 
  'Test aktywnego postoju', 
  CURRENT_DATE, 
  true
);

-- Sprawdź czy został dodany
SELECT * FROM downtimes WHERE is_active = true;