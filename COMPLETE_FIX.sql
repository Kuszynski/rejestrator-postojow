-- KOMPLETNA NAPRAWA BAZY DANYCH DLA REAL-TIME MONITORING

-- 1. Dodaj kolumnę is_active jeśli nie istnieje
ALTER TABLE downtimes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;

-- 2. Usuń ograniczenie NOT NULL z end_time (dla aktywnych postojów)
ALTER TABLE downtimes ALTER COLUMN end_time DROP NOT NULL;

-- 3. Ustaw domyślną wartość dla is_active
ALTER TABLE downtimes ALTER COLUMN is_active SET DEFAULT FALSE;

-- 4. Napraw istniejące rekordy
UPDATE downtimes SET is_active = FALSE WHERE is_active IS NULL;

-- 5. Dodaj indeks dla lepszej wydajności
CREATE INDEX IF NOT EXISTS idx_downtimes_is_active ON downtimes(is_active);
CREATE INDEX IF NOT EXISTS idx_downtimes_date_active ON downtimes(date, is_active);

-- 6. Włącz realtime dla tabeli downtimes
ALTER PUBLICATION supabase_realtime ADD TABLE downtimes;

-- 7. Sprawdź strukturę tabeli
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'downtimes' 
ORDER BY ordinal_position;