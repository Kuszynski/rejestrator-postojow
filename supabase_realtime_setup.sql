-- Dodaj kolumnę is_active do tabeli downtimes
ALTER TABLE downtimes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;

-- Indeks dla aktywnych postojów
CREATE INDEX IF NOT EXISTS idx_downtimes_is_active ON downtimes(is_active);

-- Włącz realtime dla tabeli downtimes
ALTER PUBLICATION supabase_realtime ADD TABLE downtimes;