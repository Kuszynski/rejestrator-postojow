-- Dodaj kolumnę photo_url do tabeli downtimes
ALTER TABLE downtimes ADD COLUMN IF NOT EXISTS photo_url TEXT;