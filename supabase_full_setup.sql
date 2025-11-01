-- Kompletna konfiguracja bazy danych dla Rejestrator Postojów
-- Uruchom ten kod w Supabase SQL Editor

-- Funkcja do automatycznego ustawiania updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 1. Tabela user_passwords
CREATE TABLE IF NOT EXISTS user_passwords (
  id SERIAL PRIMARY KEY,
  user_id VARCHAR(10) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Tabela machines
CREATE TABLE IF NOT EXISTS machines (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Tabela downtimes
CREATE TABLE IF NOT EXISTS downtimes (
  id SERIAL PRIMARY KEY,
  machine_id VARCHAR(20) NOT NULL,
  operator_id VARCHAR(10) NOT NULL,
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE,
  duration INTEGER,
  comment TEXT NOT NULL,
  post_number VARCHAR(50),
  date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indeksy
CREATE INDEX IF NOT EXISTS idx_user_passwords_user_id ON user_passwords(user_id);
CREATE INDEX IF NOT EXISTS idx_downtimes_machine_id ON downtimes(machine_id);
CREATE INDEX IF NOT EXISTS idx_downtimes_operator_id ON downtimes(operator_id);
CREATE INDEX IF NOT EXISTS idx_downtimes_date ON downtimes(date);

-- RLS
ALTER TABLE user_passwords ENABLE ROW LEVEL SECURITY;
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE downtimes ENABLE ROW LEVEL SECURITY;

-- Polityki RLS
CREATE POLICY "Allow all operations on user_passwords" ON user_passwords FOR ALL USING (true);
CREATE POLICY "Allow all operations on machines" ON machines FOR ALL USING (true);
CREATE POLICY "Allow all operations on downtimes" ON downtimes FOR ALL USING (true);

-- Triggery
DROP TRIGGER IF EXISTS update_user_passwords_updated_at ON user_passwords;
CREATE TRIGGER update_user_passwords_updated_at 
    BEFORE UPDATE ON user_passwords 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_machines_updated_at ON machines;
CREATE TRIGGER update_machines_updated_at 
    BEFORE UPDATE ON machines 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_downtimes_updated_at ON downtimes;
CREATE TRIGGER update_downtimes_updated_at 
    BEFORE UPDATE ON downtimes 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Domyślne maszyny
INSERT INTO machines (id, name, color) VALUES 
('m1', 'Hjullaster', 'bg-blue-500'),
('m2', 'Tømmerbord', 'bg-green-500'),
('m3', 'Tømmerhest, Enstokkmater, Rotreduserer', 'bg-yellow-500'),
('m4', 'Hev/Senk, Barkemaskin', 'bg-purple-500'),
('m5', 'Styreverk, Avkast, Innmating', 'bg-red-500'),
('m6', 'Barktransport', 'bg-indigo-500'),
('m7', 'Reduserere', 'bg-pink-500'),
('m8', 'Transport inkl. Vendere', 'bg-orange-500'),
('m9', 'FR 16, Bordavskiller, Bordtransport', 'bg-teal-500'),
('m10', 'FR15/FR12', 'bg-cyan-500'),
('m11', 'Avkast, Buffertransport, Elevator', 'bg-lime-500'),
('m12', 'Råsortering', 'bg-emerald-500'),
('m13', 'Strølegger', 'bg-violet-500'),
('m14', 'Omposting/Korigering', 'bg-fuchsia-500'),
('m15', 'Bladbytte', 'bg-rose-500'),
('m16', 'Diverse', 'bg-slate-500')
ON CONFLICT (id) DO NOTHING;

-- Oppdater eksisterende brukere til riktige navn
UPDATE user_passwords SET user_id = 'operatør' WHERE user_id = 'operator';
UPDATE user_passwords SET user_id = 'Dag' WHERE user_id = 'dag';
UPDATE user_passwords SET user_id = 'Kveld' WHERE user_id = 'kveld';

-- Legg til manglende brukere hvis de ikke finnes
INSERT INTO user_passwords (user_id, password_hash) VALUES 
('operatør', 'temp'),
('Dag', 'temp'),
('Kveld', 'temp'),
('sjef', 'temp'),
('admin', 'temp')
ON CONFLICT (user_id) DO NOTHING;