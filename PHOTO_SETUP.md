# 📸 Instrukcja dodania zdjęć do postojów

## 1. Aktualizuj bazę danych
Uruchom w Supabase SQL Editor:
```sql
ALTER TABLE downtimes ADD COLUMN IF NOT EXISTS photo_url TEXT;
```

## 2. Jak używać
1. **Zaloguj się** jako operator
2. **Kliknij "I dag"** - zobacz dzisiejsze postoje  
3. **Kliknij przycisk "Rediger"** przy postoju
4. **Dodaj zdjęcie**:
   - Kliknij "Velg fil" 
   - Zrób zdjęcie aparatem lub wybierz z galerii
   - Zdjęcie pojawi się jako podgląd
5. **Zapisz zmiany**

## 3. Gdzie zobaczysz zdjęcia
- **I dag** - miniaturki w tabeli
- **Dag rapport** - zdjęcia w szczegółach
- **Raporty managerów** - pełne zdjęcia

## 4. Funkcje zdjęć
- ✅ Automatyczne skalowanie
- ✅ Podgląd przed zapisaniem  
- ✅ Usuwanie zdjęć
- ✅ Kliknij miniaturkę = pełny rozmiar
- ✅ Działa na telefonie i tablecie

## 5. Korzyści dla managerów
- Widzą dokładnie co się stało
- Lepsze zrozumienie problemów
- Szybsza diagnoza
- Dokumentacja wizualna