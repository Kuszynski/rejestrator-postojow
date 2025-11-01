# 🏭 Konfiguracja tabeli machines w Supabase

## 📋 Instrukcja krok po kroku:

### 1. Zaloguj się do Supabase
- Przejdź do [supabase.com](https://supabase.com)
- Zaloguj się do swojego konta
- Wybierz projekt rejestrator-postojów

### 2. Otwórz SQL Editor
- W lewym menu kliknij **SQL Editor**
- Kliknij **New query**

### 3. Uruchom skrypt SQL
- Skopiuj całą zawartość pliku `supabase_machines_setup.sql`
- Wklej do SQL Editor
- Kliknij **Run** (lub Ctrl+Enter)

### 4. Sprawdź czy tabela została utworzona
- W lewym menu kliknij **Table Editor**
- Powinieneś zobaczyć nową tabelę **machines**
- Tabela powinna zawierać 16 domyślnych maszyn

## ✅ Co zostanie utworzone:

### 📊 Tabela `machines`:
- `id` - Unikalny identyfikator maszyny (VARCHAR)
- `name` - Nazwa maszyny (VARCHAR)
- `color` - Kolor maszyny w formacie Tailwind (VARCHAR)
- `created_at` - Data utworzenia (TIMESTAMP)
- `updated_at` - Data ostatniej modyfikacji (TIMESTAMP)

### 🔒 Bezpieczeństwo:
- Row Level Security (RLS) włączone
- Polityka pozwalająca na wszystkie operacje
- Automatyczne triggery do aktualizacji `updated_at`

### 🏭 Domyślne maszyny:
1. Hjullaster (niebieski)
2. Tømmerbord (zielony)
3. Tømmerhest, Enstokkmater, Rotreduserer (żółty)
4. Hev/Senk, Barkemaskin (fioletowy)
5. Styreverk, Avkast, Innmating (czerwony)
6. Barktransport (indygo)
7. Reduserere (różowy)
8. Transport inkl. Vendere (pomarańczowy)
9. FR 16, Bordavskiller, Bordtransport (teal)
10. FR15/FR12 (cyan)
11. Avkast, Buffertransport, Elevator (lime)
12. Råsortering (emerald)
13. Strølegger (violet)
14. Omposting/Korigering (fuchsia)
15. Bladbytte (rose)
16. Diverse (slate)

## 🚀 Po uruchomieniu skryptu:

1. **Aplikacja automatycznie przełączy się na Supabase**
2. **Manager może dodawać/edytować/usuwać maszyny**
3. **Operatorzy widzą zaktualizowaną listę maszyn**
4. **Wszystkie zmiany są synchronizowane w czasie rzeczywistym**

## ⚠️ Ważne:
- Uruchom skrypt tylko raz
- Jeśli tabela już istnieje, skrypt nie nadpisze danych
- Backup istniejących danych zostanie zachowany