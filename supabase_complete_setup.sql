-- Kompletna konfiguracja bazy danych dla Rejestrator Postojów
-- Uruchom ten kod w Supabase SQL Editor

-- 1. Tabela user_passwords (już istnieje, ale dodajemy dla kompletności)
CREATE TABLE IF NOT EXISTS user_passwords (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(10) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela downtimes - główna tabela z postojami
CREATE TABLE IF NOT EXISTS downtimes (
  id SERIAL PRIMARY KEY,
  machine_id VARCHAR(10) NOT NULL,
  operator_id VARCHAR(10) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER, -- w minutach
  comment TEXT NOT NULL,
  post_number VARCHAR(50),
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indeksy dla lepszej wydajności
CREATE INDEX IF NOT EXISTS idx_user_passwords_user_id ON user_passwords(user_id);
CREATE INDEX IF NOT EXISTS idx_downtimes_machine_id ON downtimes(machine_id);
CREATE INDEX IF NOT EXISTS idx_downtimes_operator_id ON downtimes(operator_id);
CREATE INDEX IF NOT EXISTS idx_downtimes_date ON downtimes(date);
CREATE INDEX IF NOT EXISTS idx_downtimes_start_time ON downtimes(start_time);

-- RLS (Row Level Security)
ALTER TABLE user_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE downtimes ENABLE ROW LEVEL SECURITY;

-- Polityki RLS - pozwalają na wszystkie operacje (można ograniczyć później)
CREATE POLICY "Allow all operations on user_passwords" ON user_passwords
  FOR ALL USING (true);

CREATE POLICY "Allow all operations on downtimes" ON downtimes
  FOR ALL USING (true);

-- Funkcja do automatycznego ustawiania updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggery do automatycznego ustawiania updated_at
DROP TRIGGER IF EXISTS update_user_passwords_updated_at ON user_passwords;
CREATE TRIGGER update_user_passwords_updated_at 
    BEFORE UPDATE ON user_passwords 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_downtimes_updated_at ON downtimes;
CREATE TRIGGER update_downtimes_updated_at 
    BEFORE UPDATE ON downtimes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Przykładowe dane testowe (opcjonalne)
-- Możesz usunąć tę sekcję jeśli nie chcesz danych testowych

-- Dodaj hasła dla użytkowników testowych (hasło: 123456)
INSERT INTO user_passwords (user_id, password_hash) VALUES 
('op1', '123456'),
('op2', '123456'),
('op3', '123456'),
('mg1', '123456'),
('ad1', '123456')
ON CONFLICT (user_id) DO NOTHING;

-- Dodaj przykładowe postoje (opcjonalne)
INSERT INTO downtimes (machine_id, operator_id, start_time, end_time, duration, comment, date) VALUES 
('m1', 'op1', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '1 hour 45 minutes', 15, 'Testowy postój - problem z hydrauliką', CURRENT_DATE),
('m2', 'op2', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '45 minutes', 15, 'Testowy postój - wymiana narzędzia', CURRENT_DATE),
('m3', 'op1', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '20 minutes', 10, 'Testowy postój - czyszczenie', CURRENT_DATE)
ON CONFLICT DO NOTHING;