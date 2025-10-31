-- Tworzenie tabeli user_passwords w Supabase
-- Uruchom ten kod w Supabase SQL Editor

CREATE TABLE IF NOT EXISTS user_passwords (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(10) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dodaj indeks dla szybszego wyszukiwania
CREATE INDEX IF NOT EXISTS idx_user_passwords_user_id ON user_passwords(user_id);

-- Dodaj RLS (Row Level Security) - opcjonalne, ale zalecane
ALTER TABLE user_passwords ENABLE ROW LEVEL SECURITY;

-- Polityka pozwalająca na odczyt i zapis dla wszystkich (można ograniczyć później)
CREATE POLICY "Allow all operations on user_passwords" ON user_passwords
  FOR ALL USING (true);

-- Funkcja do automatycznego ustawiania updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger do automatycznego ustawiania updated_at przy UPDATE
CREATE TRIGGER update_user_passwords_updated_at 
    BEFORE UPDATE ON user_passwords 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();