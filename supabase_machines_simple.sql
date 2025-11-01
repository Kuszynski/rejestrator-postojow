-- Uproszczony skrypt dla tabeli machines
-- Uruchom ten kod w Supabase SQL Editor

-- Funkcja do automatycznego ustawiania updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Tabela machines
CREATE TABLE IF NOT EXISTS machines (
  id VARCHAR(20) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE machines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all operations on machines" ON machines FOR ALL USING (true);

-- Trigger
DROP TRIGGER IF EXISTS update_machines_updated_at ON machines;
CREATE TRIGGER update_machines_updated_at 
    BEFORE UPDATE ON machines 
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