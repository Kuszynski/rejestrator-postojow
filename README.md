# Rejestrator Postojów - Nowoczesna Aplikacja PWA

## 🚀 Funkcjonalności

### ✅ Dla Operatorów:
- **Intuicyjny interfejs** - Prosty w obsłudze tracker postojów
- **Timer w czasie rzeczywistym** - Widoczny czas trwania postoju
- **Szybkie przyciski** - Najczęstsze przyczyny postojów
- **Aplikacja PWA** - Działa jak natywna aplikacja na telefonie
- **Praca offline** - Dane synchronizują się po powrocie połączenia

### ✅ Dla Managerów:
- **Live Dashboard** - Monitoring postojów w czasie rzeczywistym
- **Inteligentne alerty** - Powiadomienia o długich postojach
- **Statystyki na żywo** - Bieżące dane produkcyjne
- **Ranking maszyn** - Które maszyny mają najwięcej postojów

### ✅ System Raportów:
- **Automatyczne raporty** - Dzienny/tygodniowy/miesięczny
- **Export CSV/PDF** - Profesjonalne raporty do druku
- **Analityka** - Trendy, top przyczyny, porównania

## 🛠️ Instalacja i Uruchomienie

### 1. Sklonuj repozytorium:
```bash
git clone https://github.com/TWOJ-USERNAME/app-rejestrator.git
cd app-rejestrator
```

### 2. Zainstaluj zależności:
```bash
npm install
```

### 3. Skonfiguruj zmienne środowiskowe:
Skopiuj `.env.example` do `.env.local` i uzupełnij dane Supabase:
```bash
cp .env.example .env.local
```

### 4. Uruchom aplikację:
```bash
npm run dev
```

### 5. Otwórz w przeglądarce:
```
http://localhost:3000
```

## 🔧 Konfiguracja Supabase

1. Utwórz projekt w [Supabase](https://supabase.com)
2. Wykonaj SQL z pliku `supabase_complete_setup.sql`
3. Uzupełnij zmienne w `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## 📱 Instalacja PWA

1. Otwórz aplikację w przeglądarce na telefonie
2. Kliknij "Dodaj do ekranu głównego" 
3. Aplikacja będzie działać jak natywna aplikacja

## 👥 Konta testowe

Po pierwszym logowaniu system poprosi o utworzenie hasła dla każdego użytkownika.

### Dostępni użytkownicy:
- **operatør** - Dostęp operatora
- **Dag** - Dostęp operatora (zmiana dzienna)
- **Kveld** - Dostęp operatora (zmiana wieczorna)
- **sjef** - Dostęp managera
- **admin** - Pełny dostęp administratora

## 🚀 Deployment na Vercel

1. Połącz repozytorium z Vercel
2. Ustaw zmienne środowiskowe w Vercel Dashboard
3. Deploy automatycznie się uruchomi

## 📊 Struktura Bazy Danych

### Tabela `user_passwords`:
- `user_id` - ID użytkownika
- `password_hash` - Hash hasła

### Tabela `downtimes`:
- `machine_id` - ID maszyny
- `operator_id` - ID operatora
- `start_time` - Czas rozpoczęcia postoju
- `end_time` - Czas zakończenia postoju
- `duration` - Czas trwania w minutach
- `comment` - Komentarz/przyczyna
- `post_number` - Numer postu
- `date` - Data postoju

## 🔮 Technologie

- **Next.js 14** - React framework
- **TypeScript** - Typowanie
- **Tailwind CSS** - Stylowanie
- **Supabase** - Baza danych i backend
- **Lucide React** - Ikony
- **PWA** - Progressive Web App

## 📝 Licencja

Aplikacja stworzona dla potrzeb wewnętrznych firmy.