-- Napraw kolumnę duration - pozwól na NULL dla aktywnych postojów
ALTER TABLE downtimes ALTER COLUMN duration DROP NOT NULL;

-- Sprawdź strukturę
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'downtimes' 
ORDER BY ordinal_position;