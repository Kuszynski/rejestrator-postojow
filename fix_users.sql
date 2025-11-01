-- Fix user accounts and add missing users
DELETE FROM user_passwords WHERE user_id IN ('operator', 'dag', 'kveld');

INSERT INTO user_passwords (user_id, password_hash) VALUES 
('operatør', '123456'),
('Dag', '123456'),
('Kveld', '123456'),
('sjef', '123456'),
('admin', '123456'),
('tv', '123456')
ON CONFLICT (user_id) DO NOTHING;