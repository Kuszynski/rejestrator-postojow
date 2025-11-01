-- Sprawdź strukturę kolumny is_active
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'downtimes' AND column_name = 'is_active';

-- Jeśli kolumna nie ma domyślnej wartości, ustaw ją
ALTER TABLE downtimes ALTER COLUMN is_active SET DEFAULT false;

-- Sprawdź czy są jakieś rekordy bez is_active
SELECT COUNT(*) as records_without_is_active 
FROM downtimes 
WHERE is_active IS NULL;

-- Ustaw is_active = false dla wszystkich istniejących rekordów gdzie jest NULL
UPDATE downtimes 
SET is_active = false 
WHERE is_active IS NULL;