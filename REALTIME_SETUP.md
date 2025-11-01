# Konfiguracja Real-time Monitoring dla Panelu Managera

## 🚀 Nowe Funkcjonalności

### ✅ Dla Managerów w sekcji "Oversikt":
- **Live tracking aktywnych postojów** - Automatyczne wyświetlanie nowych rejestracji w czasie rzeczywistym
- **Timer w czasie rzeczywistym** - Widoczny czas trwania aktywnych postojów z aktualizacją co sekundę
- **Automatyczne powiadomienia** - Nowe postoje pojawiają się natychmiast bez odświeżania strony
- **Wizualne oznaczenia** - Aktywne postoje są wyróżnione czerwonym tłem i animacją
- **Statystyki na żywo** - Licznik aktywnych postojów w statystykach

## 🛠️ Wymagane Kroki Konfiguracji

### 1. Aktualizacja Bazy Danych Supabase

Wykonaj poniższy kod SQL w Supabase SQL Editor:

```sql
-- Dodaj kolumnę is_active do tabeli downtimes
ALTER TABLE downtimes ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT FALSE;

-- Indeks dla aktywnych postojów
CREATE INDEX IF NOT EXISTS idx_downtimes_is_active ON downtimes(is_active);

-- Włącz realtime dla tabeli downtimes
ALTER PUBLICATION supabase_realtime ADD TABLE downtimes;
```

### 2. Restart Aplikacji

Po wykonaniu SQL, zrestartuj aplikację:

```bash
npm run dev
```

## 📱 Jak to działa

### Dla Operatorów:
1. Gdy operator kliknie przycisk maszyny - postój zostaje natychmiast zapisany do bazy jako aktywny
2. Timer zaczyna odliczać czas lokalnie
3. Gdy operator zatrzyma postój - rekord zostaje zaktualizowany z czasem końcowym

### Dla Managerów:
1. Panel "Oversikt" automatycznie wykrywa nowe aktywne postoje
2. Aktywne postoje są wyświetlane na górze listy z czerwonym tłem
3. Timer dla każdego aktywnego postoju aktualizuje się co sekundę
4. Po zakończeniu postoju przez operatora, rekord automatycznie przenosi się do sekcji zakończonych

## 🔧 Funkcje Real-time

- **Automatyczne odświeżanie** - Dane aktualizują się bez potrzeby odświeżania strony
- **Live timer** - Czas aktywnych postojów aktualizuje się co sekundę
- **Instant notifications** - Nowe postoje pojawiają się natychmiast
- **Visual indicators** - Animacje i kolory dla aktywnych postojów

## 📊 Nowe Elementy UI

### W Panelu Managera:
- **Czerwone karty** dla aktywnych postojów z animacją pulse
- **Badge "AKTYWNY"** na aktywnych postojach
- **Licznik aktywnych postojów** w statystykach
- **Emoji ⏱️** dla oznaczenia trwających postojów

### Statystyki:
- Liczba wszystkich postojów (aktywne + zakończone)
- Osobny licznik aktywnych postojów
- Łączny czas postojów (włączając aktywne)

## 🚨 Rozwiązywanie Problemów

### Jeśli aktywne postoje nie pojawiają się:
1. Sprawdź czy wykonałeś SQL w Supabase
2. Zrestartuj aplikację
3. Sprawdź konsole przeglądarki pod kątem błędów

### Jeśli timer nie aktualizuje się:
1. Sprawdź połączenie internetowe
2. Odśwież stronę panelu managera
3. Sprawdź czy Supabase realtime jest włączony

## 📝 Uwagi Techniczne

- Dane są synchronizowane między localStorage a Supabase
- Real-time działa przez WebSocket connections
- Fallback do localStorage w przypadku problemów z bazą danych
- Automatyczne sprawdzanie aktywnych postojów przy starcie aplikacji