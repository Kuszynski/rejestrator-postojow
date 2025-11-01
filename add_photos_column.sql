-- Dodaj kolumnę dla zdjęć do tabeli downtimes
ALTER TABLE downtimes ADD COLUMN IF NOT EXISTS photo_url TEXT;