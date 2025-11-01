-- Sprawdź strukturę tabeli downtimes
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'downtimes' 
ORDER BY ordinal_position;

-- Sprawdź czy są jakieś aktywne postoje
SELECT * FROM downtimes WHERE is_active = true;

-- Sprawdź wszystkie postoje z dzisiaj
SELECT * FROM downtimes WHERE date = CURRENT_DATE ORDER BY start_time DESC;