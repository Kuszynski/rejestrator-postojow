# Setup Instruksjoner - Rejestrator Postojów

## 🔧 Supabase Oppsett

### 1. Kjør SQL-skriptene i Supabase SQL Editor i denne rekkefølgen:

1. **Først**: `supabase_full_setup.sql` - Oppretter alle tabeller og grunndata
2. **Deretter**: `fix_users.sql` - Fikser brukernavnene til riktige norske navn

### 2. Verifiser at alt fungerer:

Kjør test-skriptet:
```bash
node test-connection.js
```

## 👥 Standard Brukere

Etter oppsett vil disse brukerne være tilgjengelige:

- **operatør** - Operator (må sette passord ved første innlogging)
- **Dag** - Dagskift operator  
- **Kveld** - Kveldsskift operator
- **sjef** - Manager/Leder
- **admin** - Administrator

## 🏭 Maskiner

Systemet kommer med 16 forhåndsdefinerte maskiner:
- m1: Hjullaster
- m2: Tømmerbord  
- m3: Tømmerhest, Enstokkmater, Rotreduserer
- ... og 13 andre

Managerere kan legge til/redigere/slette maskiner via "Maskiner" fanen.

## 🚀 Funksjonalitet

### For Operatører:
- Registrere stanser på maskiner
- Se dagens stanser
- Generere post-rapporter
- Eksportere data til Excel

### For Managere:
- Alt som operatører kan
- Administrere maskiner (legge til/redigere/slette)
- Se detaljerte analyser og statistikker
- Eksportere historiske data

## 🔒 Sikkerhet

- Alle passord lagres sikkert i Supabase
- Row Level Security (RLS) er aktivert
- Ingen sensitive data i koden

## 📊 Database Struktur

- **machines**: Maskindata (id, navn, farge)
- **user_passwords**: Brukerautentisering  
- **downtimes**: Stanseregistreringer med full historikk