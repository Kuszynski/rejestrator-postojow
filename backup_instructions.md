# Backup Instrukcje dla Supabase

## Metoda 1: Dashboard Supabase (Zalecana)
1. Wejdź na https://supabase.com
2. Wybierz swój projekt
3. Idź do Settings → Database
4. Kliknij "Database backups"
5. Pobierz najnowszy backup jako plik .sql

## Metoda 2: Automatyczne backupy
- Supabase automatycznie tworzy backupy codziennie
- Dostępne przez 7 dni (plan darmowy)
- Można przywrócić przez Dashboard

## Metoda 3: Export danych przez aplikację
- W panelu managera można eksportować dane do CSV/Excel
- To nie jest pełny backup bazy, ale backup danych

## Metoda 4: pg_dump (zaawansowana)
```bash
# Pobierz connection string z Supabase Dashboard
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" > backup_$(date +%Y%m%d).sql
```

## Przywracanie backupu
1. Przez Dashboard Supabase → Database → Backups → Restore
2. Lub przez psql:
```bash
psql "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" < backup.sql
```

## Zalecenia
- Rób backup przed ważnymi zmianami
- Testuj przywracanie na kopii projektu
- Przechowuj backupy lokalnie jako dodatkowe zabezpieczenie