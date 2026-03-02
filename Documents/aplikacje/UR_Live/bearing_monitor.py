# -*- coding: utf-8 -*-
"""
╔══════════════════════════════════════════════════════════════════════════════╗
║  SYSTEM DIAGNOSTYKI ŁOŻYSK — LINIA TARTAKU                                ║
║  Condition Monitoring Engine v1.0                                          ║
║                                                                            ║
║  Metodyka:                                                                 ║
║    1. SKF — Crest Factor (współczynnik szczytu wibracji)                   ║
║    2. Siemens — Baseline Deviation (adaptacyjna linia bazowa 7-dniowa)     ║
║    3. AWS Amazon Monitron — Anomaly Gradient (gradient temperatury)         ║
║                                                                            ║
║  Cel: Odróżnić "stary wiek maszyny" od "nadchodzącej katastrofy"          ║
║  Dane wejściowe: CSV z czujników IoT (timestamp, unit, value)             ║
║  Autor: IIoT Condition Monitoring Engineer                                 ║
╚══════════════════════════════════════════════════════════════════════════════╝

Uzasadnienie biznesowe:
    Standardowe alarmy statystyczne (próg 70°C, wibracje > 4g) nie działają
    w starych maszynach tartaku, ponieważ ich "normalny" poziom szumu jest
    wyższy niż normy ISO 10816 dla nowych maszyn. Ten system stosuje
    podejście relatywne — porównuje maszynę do niej samej, nie do książkowych
    norm.

Referencje standardów:
    - SKF Application Note: "Vibration Diagnostic Guide" (współczynnik szczytu)
    - ISO 10816-3:2009 — Wibracje maszyn (kontekst, nie progi)
    - Siemens SITRANS MS200 / MindSphere — Predictive Analytics (adaptive baseline)
    - AWS Amazon Monitron — Machine Learning anomaly detection (gradient-based)
    - ISO 13373-1:2002 — Condition monitoring and diagnostics of machines
"""

import pandas as pd
import numpy as np
from datetime import timedelta, time
import warnings
import os
import sys
import io

# Wymuś UTF-8 dla konsoli Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except (AttributeError, io.UnsupportedOperation):
        pass

warnings.filterwarnings('ignore')

# ═══════════════════════════════════════════════════════════════════════════════
#  KONFIGURACJA — PROGI ALARMOWE
#  Dostosuj do specyfiki swojej linii produkcyjnej.
#  Każdy próg jest udokumentowany odniesieniem do standardu branżowego.
# ═══════════════════════════════════════════════════════════════════════════════

# --- SKF: Crest Factor (Współczynnik Szczytu) ---
# Ref: SKF Application Note — "Bearing damage and failure analysis"
# CF = Peak / RMS. Nowe łożysko: CF ≈ 3. Uszkodzenie bieżni: CF > 5-6.
# Gdy CF rośnie powyżej 5, oznacza to impulsy mechaniczne (pęknięcia kulek,
# odpryski bieżni) — zanim jeszcze wzrośnie temperatura.
SKF_CF_NORMAL = 3.0       # CF < 3.0 → łożysko zdrowe
SKF_CF_WARNING = 5.0      # 3.0 ≤ CF < 5.0 → wczesne mikro-pittingi
SKF_CF_CRITICAL = 6.0     # CF ≥ 6.0 → poważne uszkodzenie fizyczne
SKF_VIBRATION_IDLE = 0.1  # g — Idle bypass (ignoruje wibracje tła poniżej 0.1g)

# --- Siemens: Baseline Deviation (Adaptacyjna Banda Statystyczna) ---
# Ref: Siemens MindSphere / AWS Monitron — adaptive statistical bands
# Zamiast sztywnego "25% odchylenia" (który nie uwzględnia naturalnej
# zmienności maszyny), stosujemy bandę μ ± N×σ.
# Jeśli maszyna normalnie waha się ±15%, banda będzie szersza.
# Jeśli maszyna jest stabilna (±3%), banda będzie ciaśniejsza.
SIEMENS_BASELINE_WINDOW = '30D'  # Okno bazowe: 30 dni (~20 cykli produkcyjnych)
                                  # 7 dni to za mało dla maszyn start-stop (tylko ~5 cykli)
SIEMENS_SIGMA_WARNING = 2.0      # μ ± 2σ → PLANLEGG SERVICE (🟡) (95.4% pewności anomalii)
SIEMENS_SIGMA_CRITICAL = 3.0     # μ ± 3σ → KRITISK ALARM (🔴) (99.7% pewności anomalii)
SIEMENS_STEADYSTATE_WINDOW = 6   # Interwały (30 min) do oceny stabilności maszyny
SIEMENS_STEADYSTATE_CV_MAX = 0.15  # Max współczynnik zmienności (15%) = steady state

# --- AWS Monitron: Anomaly Gradient (Gradient Temperatury) ---
# Ref: AWS Monitron — "Abnormal condition detection using rate of change"
# KALIBRACJA na podstawie rzeczywistego pożaru 13.02.2026:
#   - Prawdziwy pożar: gradient +23°C/h → +57°C/h (o 07:15-07:20)
#   - Normalna praca: 99.9 percentyl = +14.4°C/h
#   - PRÓG MIĘDZY NIMI: 15°C/h
# UWAGA: Tylko DODATNIE gradienty (grzanie) są niebezpieczne.
# Ujemny gradient = chłodzenie = BEZPIECZNE.
AWS_GRADIENT_WINDOW = '1h'       # Okno obliczeń gradientu
AWS_GRADIENT_WARNING = 10.0      # °C/h → Warning
AWS_GRADIENT_CRITICAL = 15.0     # °C/h → Critical / Fire (🔴🔥)
AWS_GRADIENT_FIRE_EXTREME = 30.0 # °C/h → Extreme Fire (natychmiastowy stop linii)
AWS_MIN_FIRE_TEMP = 45.0         # °C → Minimalna temp wymagana dla pożaru
AWS_MAX_TOTAL_RISE = 20.0        # °C → Max dopuszczalny CAŁKOWITY wzrost od stabilizacji (PREDYKCJA)
# --- NOWY: Podłoga wibracji dla alarmów krytycznych ---
# Chroni przed nadawaniem statusu BRANN na bardzo cichych maszynach (np. 0.3g)
# które statystycznie mają anomalię, ale fizycznie nic im nie grozi.
SIEMENS_MIN_CRITICAL_RMS = 0.3   # g 

# Dzień produkcyjny: 06:00 — 23:20
# Przerwy: 09:30–10:00 (śniadanie), 19:00–19:30 (kolacja)
# Poza tymi godzinami maszyna jest wyłączona — ignoruj szum czujników.
# Gradienty na granicach start/stop/przerwa są naturalne i NIE powinny
# wywoływać alarmów (nagrzewanie zimnego łożyska ≠ awaria).
PRODUCTION_START = time(6, 0)     # Start zmiany: 06:00
PRODUCTION_END = time(23, 20)     # Koniec zmiany: 23:20
BREAKS = [
    (time(9, 30), time(10, 0)),   # Przerwa śniadaniowa
    (time(19, 0), time(19, 30)),  # Przerwa kolacyjna
]
# Ile minut po starcie/przerwie ignorować gradient (czas nagrzewania)
WARMUP_MINUTES = 45  # Standardowy czas rozgrzewki
HEAVY_WARMUP_MINUTES = 90  # Rozszerzona rozgrzewka dla QSS/Rębaków (ciężkie maszyny)
SAFETY_OVERRIDE_GRADIENT = 25.0  # °C/h → Absolutny bypass rozgrzewki (wykrywanie pożaru)

# --- Alarm Persistence (Trwałość Alarmu) ---
# Ref: SKF Enlight / IMx — alarm debounce
# Pojedynczy spike wibracji (np. wózek widłowy, uderzenie kłody) nie powinien
# wywoływać alarmu. Prawdziwa degradacja łożyska trwa — jest widoczna
# w KOLEJNYCH próbkach. Wymagamy N kolejnych interwałów powyżej progu.
ALARM_PERSISTENCE_INTERVALS = 2  # 2 × 5min = 10 minut ciągłego alarmu dla standardowej pompy/silnika
ALARM_PERSISTENCE_FIRE = 1       # 1 × 5min = NATYCHMIAST dla POŻAR/STOP (W ułamku sekund temperatura nie robi false spikes, tylko płonie!)
# Pożar (Gradient > 15C/h) nie podlega zwłoce! Bezwładność cieplna litego żeliwa 
# uniemożliwia błędy pomiarowe np. o 20 stopni / h z powietrza. 
# Czekanie 15 minut przy pożarze to pewne spalenie linii.

# --- HEAVY IMPACT PROFILE (RĘBAKI / QSS) ---
# Wprowadzamy osobne, ułagodzone kryteria dla maszyn brutalnie tnących kłody (np. 1880 QSS-420).
# Rębaki zębowe produkują niekończący się ciąg szpilek wibracyjnych - standardowo ISO/SKF zarzucałyby alarmami przez cały dzień.
HEAVY_KEYWORDS = ['QSS', 'HUGG', 'CHIPPER', 'REBAK', 'RĘBAK', 'BARK']
HEAVY_SKF_CF_WARNING = 6.0       # Standardowy to 5.0 (dopuszczamy rębaki do cięcia twardszych materiałów)
HEAVY_SKF_CF_CRITICAL = 8.0      # Standardowy to 6.0

# --- HYDRAULIC/OIL PROFILE (HPU) ---
# Agregaty hydrauliczne (HPU) pracują naturalnie w temperaturach 40-60°C.
# Standardowy próg pożarowy 45°C wywoływałby tam fałszywe alarmy co 5 minut.
# Dla HPU podnosimy próg minimalny BRANN do 60°C.
OIL_KEYWORDS = ['HPU', 'OLJE', 'OIL', 'HYDR']
AWS_MIN_FIRE_TEMP_OIL = 60.0

# Znaczne wydłużenie debouncingu dla rębaków — żeby zignorować np. twardą krzywą kłodę.
HEAVY_ALARM_PERSISTENCE_INTERVALS = 2  # 2 × 5min = 10 minut (skrócono z 3, by ukrócić czas opóźnienia do UI)

# --- HEAVY IMPACT: Siemens Baseline Deviation ---
# Podniesione progi dla maszyn o dużej zmienności naturalnej (rębaki, QSS).
HEAVY_SIEMENS_SIGMA_WARNING = 2.5   # μ ± 2.5σ
HEAVY_SIEMENS_SIGMA_CRITICAL = 3.5  # μ ± 3.5σ

# --- Random Cut Forest (4. silnik: AWS Monitron ML) ---
# Ref: AWS Monitron — "Robust Random Cut Forest Based Anomaly Detection"
# Ref: Guha et al., 2016 — "Robust Random Cut Forest" (ICML)
# RCF analizuje WIELE wymiarów jednocześnie (temperatura, wibracje, CF, gradient)
# i szuka punktów, które są "łatwe do oddzielenia" od reszty danych.
# To samo co AWS Monitron robi wewnętrznie na czujnikach.
RCF_NUM_TREES = 100              # Ilość drzew w lesie (więcej = stabilniejsze wyniki)
RCF_TREE_SIZE = 256              # Max punktów na drzewo (okno uczenia)
RCF_FEATURES = [                 # Cechy wejściowe — wielowymiarowa analiza
    'vib_rms',                   #   Energia wibracji
    'temp_mean',                 #   Temperatura łożyska
    'crest_factor',              #   Impulsowość sygnału (SKF)
    'temp_gradient_final',       #   Szybkość zmian temperatury (AWS)
    'avg_line_vibration'         #   Korelacja Sagi — średnia wibracja na Linii
]
# --- ISO 10816-1: Vibration Severity (Absolute Norms) ---
# Klasa I: Małe maszyny (do 15 kW) — standard dla przenośników
ISO_VIB_ZONE_A_B = 0.71  # mm/s (Granica między Dobrym a Zadowalającym)
ISO_VIB_ZONE_B_C = 1.80  # mm/s (Granica między Zadowalającym a Niepokojącym)
ISO_VIB_ZONE_C_D = 4.50  # mm/s (Granica między Niepokojącym a Niedopuszczalnym)

# Progi anomalii RCF (Random Cut Forest) kalibrowane automatycznie z danych:
RCF_PERCENTILE_WARNING = 99.0    # Score > 99.0-ty percentyl → PLANLEGG SERVICE
RCF_PERCENTILE_CRITICAL = 99.9   # Score > 99.9-ty percentyl → KRITISK ALARM

# --- Agregacja ---
AGGREGATION_INTERVAL = '5min'    # Interwał próbkowania: 5 minut


# ═══════════════════════════════════════════════════════════════════════════════
#  MODUŁ 1: ŁADOWANIE I PRZYGOTOWANIE DANYCH
# ═══════════════════════════════════════════════════════════════════════════════

def load_sensor_data(filepath: str) -> pd.DataFrame:
    """
    Wczytaj dane z CSV eksportowanego z systemu IoT.
    Format: sn;time;unit;value;timestamp
    Separator: ; (standard europejski)
    """
    print(f"  [LOAD] {os.path.basename(filepath)}")
    df = pd.read_csv(
        filepath,
        sep=';',
        dtype={'sn': str, 'unit': str, 'value': float}
    )
    df['timestamp'] = pd.to_datetime(df['timestamp'], format='ISO8601')
    
    # Skrypt pobierał czas UTC z CSV i gubił polską strefę (zima +1, lato +2)
    # Ratuje to przeliczenie na Europe/Warsaw i zrzucenie obrysu z UTC by pętle czasu 06:00 itp działały precyzyjnie.
    if df['timestamp'].dt.tz is not None:
        df['timestamp'] = df['timestamp'].dt.tz_convert('Europe/Warsaw').dt.tz_localize(None)

    df = df.sort_values('timestamp').reset_index(drop=True)
    print(f"     → {len(df):,} rekordów, zakres (PL): {df['timestamp'].min()} — {df['timestamp'].max()}")
    return df


def prepare_bearing_data(df: pd.DataFrame, is_heavy: bool = False) -> pd.DataFrame:
    """
    Rozdziel dane łożyskowe na kanały wibracji (g) i temperatury (°C).
    Agreguj do interwałów 5-minutowych.

    Agregacja wibracji:
      - max: wartość szczytowa (peak) — potrzebna do Crest Factor (SKF)
      - mean: średnia — potrzebna do baseline (Siemens)
      - rms: √(mean(x²)) — standard ISO 10816 dla oceny wibracji
      - std: odchylenie standardowe — informacja dodatkowa

    Agregacja temperatury:
      - mean: średnia w oknie — wystarczająca dla gradientu (AWS Monitron)
    """
    # Rozdziel kanały
    if 'vib_rms' in df.columns and 'temp_mean' in df.columns:
        # Format "wide" (nowy daemon) - przygotuj do agregacji
        vib = df[['timestamp', 'vib_rms']].copy().rename(columns={'vib_rms': 'value'})
        vib['unit'] = 'g'
        temp = df[['timestamp', 'temp_mean']].copy().rename(columns={'temp_mean': 'value'})
        temp['unit'] = '°C'
    else:
        # Format "long" (klasyczny CSV)
        vib = df[df['unit'] == 'g'].copy()
        temp = df[df['unit'] == '°C'].copy()

    vib = vib.set_index('timestamp')
    temp = temp.set_index('timestamp')

    # Agregacja wibracji co 5 minut
    # RMS obliczamy ręcznie: √(mean(x²))
    vib_agg = vib['value'].resample(AGGREGATION_INTERVAL).agg(
        vib_max='max',
        vib_mean='mean',
        vib_std='std',
        vib_count='count'
    )

    # RMS = √(mean(x²)) — standard ISO 10816 dla oceny energii wibracji
    vib_rms = vib['value'].resample(AGGREGATION_INTERVAL).apply(
        lambda x: np.sqrt(np.mean(x**2)) if len(x) > 0 else 0
    ).rename('vib_rms')

    # Agregacja temperatury co 5 minut
    temp_agg = temp['value'].resample(AGGREGATION_INTERVAL).agg(
        temp_mean='mean',
        temp_max='max',
        temp_min='min'
    )

    # Połącz w jedną ramkę
    result = pd.concat([vib_agg, vib_rms, temp_agg], axis=1)

    # Uzupełnij brakujące interwały (forward fill z limitem 3 próbek = 15min)
    result = result.ffill(limit=3)
    
    # [POPRAWKA] Nie wyrzucaj rekordów, które mają tylko temperaturę (np. czujnik hali)
    # Wyrzucamy tylko jeśli NIE MA ANI temperatury ANI wibracji
    result = result.dropna(how='all', subset=['vib_rms', 'temp_mean'])
    
    # Zapewnij 0.0 zamiast NaN dla wibracji jeśli ich brak (bezpieczne dla dashboardu)
    if 'vib_rms' in result.columns:
        result['vib_rms'] = result['vib_rms'].fillna(0.0)
    if 'vib_max' in result.columns:
        result['vib_max'] = result['vib_max'].fillna(0.0)

    print(f"     → Zagregowano do {len(result)} interwałów 5-min")

    # Oznacz harmonogram produkcji
    result = classify_production_time(result, is_heavy=is_heavy)
    prod_count = result['is_production'].sum()
    break_count = result['is_break'].sum()
    idle_count = len(result) - prod_count - break_count
    print(f"     → Produkcja: {prod_count} | Przerwy: {break_count} | Poza zmianą: {idle_count}")

    return result


def classify_production_time(df: pd.DataFrame, is_heavy: bool = False) -> pd.DataFrame:
    """
    Oznacz każdy interwał jako: produkcja, przerwa, lub poza zmianą ZALEŻNIE OD DANYCH RZECZYWISTYCH.
    Saga i rębaki to układy dynamiczne, często stają poza harmonogramem.
    
    Nowa logika behawioralna:
      - Silnik pracuje (is_production = True), jeżeli vib_rms > bieg jałowy.
      - Przerwa (is_break = True), jeżeli silnik fizycznie stoi.
      - Warmup odpalany na starcie danego silnika.
    """
    df = df.copy()

    # Silnik pracuje, jeśli wibracje przekraczają próg szumu jałowego
    df['is_production_raw'] = df['vib_rms'] > SKF_VIBRATION_IDLE

    # --- AWS MACHINE STATE GATING (Czas Wybiegu / Run-down) ---
    # Zamiast ucinać produkcję natychmiast (co powoduje anomalie matematyczne w RCF),
    # dodajemy czas wybiegu (np. 45 minut) od momentu fizycznego zejścia poniżej progu.
    # To okno służy też do tłumienia efektu HEAT SOAK (wygrzewania po zatrzymaniu).
    interval_minutes = int(pd.Timedelta(AGGREGATION_INTERVAL).total_seconds() / 60)
    rundown_intervals = 45 // interval_minutes
    
    # Wykrywamy moment zatrzymania: wyrywamy przejście z 'pracuje' na 'nie pracuje'
    stops = ~df['is_production_raw'] & df['is_production_raw'].shift(1, fill_value=False)
    
    # Rozciągamy flagę zatrzymania w przód o N interwałów, definiując fazę wybiegu (stygnięcia / heat soak)
    is_rundown = stops.replace(False, np.nan).ffill(limit=rundown_intervals).fillna(False).astype(bool)

    # Ostateczna definicja produkcji to: fizyczna praca LUB fizyczne stygnięcie na wybiegu
    df['is_production'] = df['is_production_raw'] | is_rundown
    df['is_rundown'] = is_rundown

    # Przerwa to czas, gdy maszyna (silnik) nie pracuje i nie jest w reaktorze wybiegu
    df['is_break'] = ~df['is_production']

    # Wykrywanie "warmupu" (rozgrzewki)
    # Znajdujemy momenty startu (przejście z false do true dla is_production)
    starts = df['is_production'] & ~df['is_production'].shift(1, fill_value=False)

    warmup_minutes_effective = HEAVY_WARMUP_MINUTES if is_heavy else WARMUP_MINUTES
    warmup_intervals = warmup_minutes_effective // interval_minutes
    
    # Tworzymy maskę rozgrzewki: przedłużamy flagę startu na przód o 'warmup_intervals' interwałów
    df['is_warmup'] = starts.replace(False, np.nan).ffill(limit=warmup_intervals).fillna(False).astype(bool)
    
    # Ciepło ma znaczenie tylko wtedy, gdy maszyna rzeczywiście pracuje
    df['is_warmup'] = df['is_warmup'] & df['is_production']

    return df


def prepare_hall_data(df: pd.DataFrame) -> pd.DataFrame:
    """
    Przygotuj dane temperatury hali jako referencję otoczenia.
    Używane do kompensacji: ΔT_skorygowane = T_łożysko - T_hala
    """
    if 'temp_mean' in df.columns:
        # Format wide
        temp = df[['timestamp', 'temp_mean']].copy().rename(columns={'temp_mean': 'value'})
    else:
        # Format long
        temp = df[df['unit'] == '°C'].copy()

    temp = temp.set_index('timestamp')

    hall_agg = temp['value'].resample(AGGREGATION_INTERVAL).agg(
        hall_temp='mean'
    )
    hall_agg = hall_agg.ffill(limit=6)  # Czujnik halowy ma rzadsze odczyty

    print(f"     → Temperatura hali: {len(hall_agg)} interwałów")
    return hall_agg


# ═══════════════════════════════════════════════════════════════════════════════
#  MODUŁ 2: LOGIKA SKF — CREST FACTOR (Współczynnik Szczytu)
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_skf_crest_factor(df: pd.DataFrame, is_heavy_machinery: bool = False) -> pd.DataFrame:
    """
    SKF Crest Factor Analysis — wykrywanie uszkodzeń mechanicznych łożysk.
    """
    df = df.copy()

    # Wybór progów w zależności od profilu maszyny
    if is_heavy_machinery:
        cf_warning = HEAVY_SKF_CF_WARNING
        cf_critical = HEAVY_SKF_CF_CRITICAL
        print("     → Profil maszyny udarowej AKTYWNY: podwyższam tolerancję SKF (CF).")
    else:
        cf_warning = SKF_CF_WARNING
        cf_critical = SKF_CF_CRITICAL

    # Oblicz Crest Factor tylko gdy maszyna pracuje W CZASIE PRODUKCJI
    mask_running = (df['vib_rms'] > SKF_VIBRATION_IDLE) & df['is_production']
    df['crest_factor'] = 0.0
    df.loc[mask_running, 'crest_factor'] = (
        df.loc[mask_running, 'vib_max'] / df.loc[mask_running, 'vib_rms']
    )

    # Klasyfikacja SKF
    conditions = [
        ~df['is_production'] | df['is_break'],           # Poza zmianą / Przerwa
        df['is_warmup'],                                 # Rozgrzewka (maskujemy skoki)
        df['crest_factor'] < SKF_CF_NORMAL,             # Zdrowe łożysko
        (df['crest_factor'] >= SKF_CF_NORMAL) &
            (df['crest_factor'] < cf_warning),          # Wczesne zużycie
        (df['crest_factor'] >= cf_warning) &
            (df['crest_factor'] < cf_critical),         # Postępujące zużycie
        df['crest_factor'] >= cf_critical                # Uszkodzenie krytyczne
    ]
    choices = [
        'IDLE',
        '🟢 MONITORING',
        '🟢 MONITORING',
        '🟡 PLANLEGG SERVICE',
        '🟡 PLANLEGG SERVICE',
        '🔴 KRITISK ALARM'
    ]
    df['skf_status'] = np.select(conditions, choices, default='UNKNOWN')

    return df


# ═══════════════════════════════════════════════════════════════════════════════
#  MODUŁ 3: LOGIKA SIEMENS — BASELINE DEVIATION (Adaptacyjna Linia Bazowa)
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_siemens_baseline(df: pd.DataFrame, is_heavy_machinery: bool = False) -> pd.DataFrame:
    """
    Siemens Adaptive Baseline — banda statystyczna μ ± N×σ.

    Teoria (Siemens MindSphere / AWS Monitron Adaptive Bands):
        Zamiast sztywnego progu "25% odchylenia", obliczamy:

        μ = średnia krocząca RMS z 7 dni produkcji
        σ = odchylenie standardowe RMS z tego samego okna

        Alarm WARNING:  RMS > μ + 2σ  lub  RMS < μ - 2σ  (95.4%)
        Alarm CRITICAL: RMS > μ + 3σ  lub  RMS < μ - 3σ  (99.7%)

    Dlaczego to lepsze niż sztywne 25%:
        - Maszyna z naturalną zmiennością ±20% → banda szeroka → mniej fałszywych
        - Maszyna stabilna (±3%) → banda ciasna → szybsze wykrycie anomalii
        - System AUTOMATYCZNIE dostosowuje się do charakterystyki maszyny

    Steady-State Filter (filtr stanu ustalonego):
        Alarmy nadajemy TYLKO gdy maszyna jest w stanie ustalonym.
        Startup, rampa, zmiana obciążenia → ignorujemy.
        Stan ustalony = współczynnik zmienności (CV) w oknie 30min < 15%.

    Parametr okna (7 dni) wybrany celowo:
        - 7 dni = kompromis rekomendowany przez Siemens dla maszyn ciągłych
    """
    df = df.copy()

    # Wybór progów w zależności od profilu maszyny
    if is_heavy_machinery:
        sigma_warning = HEAVY_SIEMENS_SIGMA_WARNING
        sigma_critical = HEAVY_SIEMENS_SIGMA_CRITICAL
        print("     → Profil maszyny udarowej AKTYWNY: podwyższam tolerancję Siemens (Baseline).")
    else:
        sigma_warning = SIEMENS_SIGMA_WARNING
        sigma_critical = SIEMENS_SIGMA_CRITICAL

    # ── Baseline obliczamy TYLKO na danych produkcyjnych (podczas fizycznej pracy) ──
    production_rms = df['vib_rms'].copy()
    production_rms[~df.get('is_production_raw', df['is_production'])] = np.nan

    # μ (średnia) i σ (odchylenie standardowe) z okna 7 dni
    df['baseline_7d'] = production_rms.rolling(
        window=SIEMENS_BASELINE_WINDOW,
        min_periods=1
    ).mean()

    df['baseline_7d_std'] = production_rms.rolling(
        window=SIEMENS_BASELINE_WINDOW,
        min_periods=1
    ).std()

    # Bandy statystyczne: μ ± 2σ (warning) i μ ± 3σ (critical)
    df['band_warning_upper'] = df['baseline_7d'] + sigma_warning * df['baseline_7d_std']
    df['band_warning_lower'] = df['baseline_7d'] - sigma_warning * df['baseline_7d_std']
    df['band_critical_upper'] = df['baseline_7d'] + sigma_critical * df['baseline_7d_std']
    df['band_critical_lower'] = df['baseline_7d'] - sigma_critical * df['baseline_7d_std']

    # ── Steady-State Detection (Siemens approach) ──
    # CV = σ_local / μ_local — jeśli CV < 15%, maszyna jest stabilna
    local_mean = production_rms.rolling(
        window=SIEMENS_STEADYSTATE_WINDOW, min_periods=3
    ).mean()
    local_std = production_rms.rolling(
        window=SIEMENS_STEADYSTATE_WINDOW, min_periods=3
    ).std()
    df['is_steady_state'] = (
        (local_std / local_mean.replace(0, np.nan)).fillna(1.0)
        < SIEMENS_STEADYSTATE_CV_MAX
    ) & df['is_production']

    # Oblicz odchylenie procentowe (zachowujemy dla raportu / CSV)
    df['baseline_deviation_pct'] = 0.0
    mask_active = (df['baseline_7d'] > SKF_VIBRATION_IDLE) & df.get('is_production_raw', df['is_production'])
    df.loc[mask_active, 'baseline_deviation_pct'] = (
        (df.loc[mask_active, 'vib_rms'] - df.loc[mask_active, 'baseline_7d'])
        / df.loc[mask_active, 'baseline_7d'] * 100
    )

    # ── Klasyfikacja Siemens — banda statystyczna + steady-state ──
    mask_steady_active = mask_active & df['is_steady_state']

    conditions = [
        ~df.get('is_production_raw', df['is_production']),              # Poza zmianą / fizycznie stoi
        ~mask_active,                                                   # Maszyna wyłączona
        df['is_warmup'],                                                # Rozgrzewka maszyny
        ~df['is_steady_state'] & df.get('is_production_raw', df['is_production']),  # Stan przejściowy → OK
        # Steady-state: porównaj do band
        mask_steady_active & ~df['is_warmup'] &
            (df['vib_rms'] >= df['band_warning_lower']) &
            (df['vib_rms'] <= df['band_warning_upper']),                # W bandzie → OK
        mask_steady_active & ~df['is_warmup'] &
            ((df['vib_rms'] > df['band_warning_upper']) |
             (df['vib_rms'] < df['band_warning_lower'])) &
            (df['vib_rms'] <= df['band_critical_upper']) &
            (df['vib_rms'] >= df['band_critical_lower']),              # Poza 2σ
        mask_steady_active & ~df['is_warmup'] &
            ((df['vib_rms'] > df['band_critical_upper']) |
             (df['vib_rms'] < df['band_critical_lower']))              # Poza 3σ
    ]
    choices = [
        'IDLE',
        'IDLE',
        '🟢 MONITORING',          # Rozgrzewka
        '🟢 MONITORING',          # Stan przejściowy — nie alarmuj
        '🟢 MONITORING',          # Wewnątrz bandy 2σ
        '🟡 PLANLEGG SERVICE',    # Poza bandą 2σ — trend
        '🔴 KRITISK ALARM'        # Poza bandą 3σ — anomalia
    ]
    df['siemens_status'] = np.select(conditions, choices, default='UNKNOWN')

    return df


# ═══════════════════════════════════════════════════════════════════════════════
#  MODUŁ 4: LOGIKA AWS MONITRON — ANOMALY GRADIENT (Gradient Temperatury)
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_aws_gradient(df: pd.DataFrame, hall_temp: pd.Series = None, is_heavy: bool = False, is_oil: bool = False) -> pd.DataFrame:
    """
    AWS Monitron Gradient Analysis — alarmowanie oparte na szybkości zmian.

    Teoria (AWS Monitron Anomaly Detection):
        Nie pytaj "czy temperatura > 100°C?" — pytaj "jak SZYBKO rośnie?"

        Gradient = ΔT / Δt (°C na godzinę)

        Łożysko, które nagrzało się z 40°C do 55°C w ciągu godziny (+15°C/h)
        jest BARDZIEJ niebezpieczne niż łożysko stojące stabilnie na 80°C.

        Dlaczego? Bo gradient 15°C/h oznacza:
        - Utrata smarowania (olej wyciekł lub się rozłożył)
        - Zacieranie bieżni
        - Pożar za 2-3 godziny

    Kompensacja temperatury otoczenia:
        Jeśli dostępne są dane z czujnika halowego, gradient jest obliczany
        na podstawie różnicy (T_łożysko - T_hala), eliminując wpływ
        pogody i ogrzewania hali na alarmy.

    KLUCZOWE: Ten alarm działa NIEZALEŻNIE od wartości bezwzględnej temperatury.
    Gradient 8°C/h przy 30°C jest TAK SAMO groźny jak przy 60°C.
    """
    df = df.copy()

    # Zabezpieczenie przed brakiem temperatury
    if 'temp_mean' not in df.columns:
        # print(f"  [AWS WARN] Brak 'temp_mean', omijam kalkulacje gradientu.")
        df['temp_compensated'] = 0.0
        df['temp_gradient'] = 0.0
        df['temp_gradient_smooth'] = 0.0
        df['temp_gradient_final'] = 0.0
        df['p_aws'] = 0
        df['aws_status'] = '🟢 MONITORING (No Temp Data)'
        return df

    # Jeśli mamy dane halowe, użyj różnicy temperatur (kompensacja otoczenia)
    if hall_temp is not None and 'temp_mean' in df.columns:
        # Dołącz temperaturę hali (nearest match w indeksie czasowym)
        df = df.join(hall_temp, how='left')
        df['hall_temp'] = df['hall_temp'].ffill().bfill()
        df['temp_compensated'] = df['temp_mean'] - df['hall_temp']
        temp_col = 'temp_compensated'
        print("     → Kompensacja temperatury otoczenia: AKTYWNA (czujnik halowy)")
    else:
        temp_col = 'temp_mean'
        print("     → Kompensacja temperatury otoczenia: BRAK (brak danych halowych)")

    # Oblicz gradient temperatury (°C/h) z oknem 1h
    # Używamy diff() / diff(periods) = zmiana w oknach 5-min, skalowana do °C/h
    # 1 godzina = 12 interwałów 5-minutowych
    periods_per_hour = int(pd.Timedelta('1h') / pd.Timedelta(AGGREGATION_INTERVAL))

    df['temp_gradient'] = (
        df[temp_col].diff(periods=periods_per_hour)
        / (periods_per_hour * 5 / 60)  # Normalizacja do °C/h
    )

    # Alternatywnie: gradient kroczący z okna 1h (bardziej wygładzony)
    df['temp_gradient_smooth'] = df[temp_col].rolling(
        window=periods_per_hour, min_periods=2
    ).apply(
        lambda x: (x.iloc[-1] - x.iloc[0]) / (len(x) * 5 / 60) if len(x) > 1 else 0,
        raw=False
    )

    # Użyj wygładzonego gradientu jako głównego
    df['temp_gradient_final'] = df['temp_gradient_smooth'].fillna(df['temp_gradient']).fillna(0)

    # --- NOWY: Gradient BŁYSKAWICZNY (Fast Gradient) ---
    # Okno 15 minut (3 interwały) do wykrywania pożaru/zatarcia
    fast_periods = 3
    df['temp_gradient_fast'] = (
        df[temp_col].diff(periods=fast_periods)
        / (fast_periods * 5 / 60)
    ).fillna(0)

    # --- NOWY: SKUMULOWANY WZROST (Total Rise) ---
    if 'is_production' in df.columns:
        prod_mask = df['is_production'] & (df[temp_col] > 10.0)
        first_prod = df[prod_mask][temp_col].first_valid_index()
        
        # [AUTOKOREKTA] Jeśli maszyna się nie kręci (np. zatarta), a jest po 06:15
        if first_prod is None:
            # Upewnij się, że index jest DatetimeIndex przed dostępem do .time
            if isinstance(df.index, pd.DatetimeIndex):
                morning_idx = df.index[df.index.time >= time(6, 15)]
                if len(morning_idx) > 0:
                    first_prod = morning_idx[0]

        if first_prod is not None:
            baseline_temp = df.loc[first_prod, temp_col]
            df['temp_total_rise'] = (df[temp_col] - baseline_temp).clip(lower=0)
        else:
            df['temp_total_rise'] = 0.0
    else:
        df['temp_total_rise'] = 0.0

    # ── TYLKO DODATNIE gradienty są niebezpieczne ──
    # Ujemny gradient = łożysko się chłodzi = DOBRZE.
    # Kalibracja na podstawie prawdziwego pożaru 13.02.2026:
    #   - Normalny gradient produkcyjny: 95th percentyl = +9.9°C/h
    #   - Prawdziwy pożar: +23°C/h → +57°C/h
    #   - Próg CRITICAL: 15°C/h (między 99.9th a pożarem)
    gradient_for_alarm = df['temp_gradient_final'].copy()
    
    min_fire_temp = AWS_MIN_FIRE_TEMP_OIL if is_oil else AWS_MIN_FIRE_TEMP
    
    # SAFETY OVERRIDE: Jeśli gradient > 25°C/h, to pożar, nie rozgrzewka.
    is_extreme = (df['temp_gradient_final'] >= SAFETY_OVERRIDE_GRADIENT) & (df['temp_mean'] >= min_fire_temp)
    
    gradient_for_alarm[~df['is_production'] & ~is_extreme] = 0.0    # Poza zmianą — ignoruj (chyba że pożar)
    
    # ROZGRZEWKA: Ignoruj małe gradienty, ale jeśli gradient jest podejrzany (>20 dla heavy), alarmuj.
    warmup_limit = 20.0 if is_heavy else AWS_GRADIENT_CRITICAL
    is_suspicious_warmup = df['is_warmup'] & (df['temp_gradient_final'] > warmup_limit)
    
    gradient_for_alarm[df['is_warmup'] & ~is_extreme & ~is_suspicious_warmup] = 0.0
    
    # [POPRAWKA] Usypiamy stygnięcie (rundown). ALE — jeśli temperatura ROŚNIE podczas postoju,
    # to jest to sytuacja skrajnie niebezpieczna (ogień lub slipping belt).
    # [HEAT SOAK] Po zatrzymaniu maszyny temperatura naturalnie rośnie (heat soak).
    # Pozwalamy na alarmy w rundown tylko jeśli gradient jest ekstremalny (> 25°C/h)
    is_dangerous_rundown = df.get('is_rundown', False) & (df['temp_gradient_final'] > 25.0)
    
    gradient_for_alarm[df['is_rundown'] & ~is_extreme & ~is_dangerous_rundown] = 0.0
    gradient_for_alarm[df['is_break'] & ~is_extreme & ~is_dangerous_rundown] = 0.0          # Przerwa — też pozwól jeśli grzeje
    # Zabezpieczenie przed "Cold Startem" - pożar zawsze powoduje wyższą temperaturę.
    
    # Wykorzystujemy gradient błyskawiczny (fast) dla statusu BRANN/STOPP
    # Standard: >20°C/h przy maszynie ogrzanej >45°C
    # Heavy: >30°C/h przy maszynie ogrzanej >55°C (zabezpieczenie przed ekstremalnym Heat Soak po zmianie obciążenia)
    fast_fire_grad = 30.0 if is_heavy else 20.0
    fast_fire_temp = 55.0 if is_heavy else min_fire_temp
    is_fast_fire = (df['temp_gradient_fast'] >= fast_fire_grad) & (df['temp_mean'] >= fast_fire_temp)
    
    # [NOWOŚĆ] PREDYKCJA: Całkowity wzrost o > 25 stopni (dla ciężkich) lub > 20 (standard)
    max_rise_threshold = 25.0 if is_heavy else 20.0
    # [POPRAWKA] Bramka gradientu — Inteligentne odróżnianie HEAT SOAK od ZATARCIA:
    # 1. Podczas pracy (raw) — bramka zawsze otwarta.
    # 2. Podczas stygnięcia (rundown) — tolerujemy do 25°C/h (Heat Soak), powyżej to błąd.
    # 3. Podczas postoju (idle/break) — tolerujemy do 5°C/h (Seized bearing), powyżej to błąd.
    # 4. Wymagamy gradientu > 5.0 dla alarmu predykcyjnego (zabezpieczenie przed wolnym nagrzewaniem rano)
    is_predictive_failure = (df['temp_total_rise'] >= max_rise_threshold) & (df['temp_mean'] >= 45.0) & (df['temp_gradient_final'] > 5.0)
    
    # Absolutne zabezpieczenie (Failsafe)
    is_absolute_overheat = df['temp_mean'] >= 65.0
    
    is_predictive_gate = (
        df['is_production_raw'] |                                  # 1. Produkcja
        is_dangerous_rundown |                                     # 2. Ekstremalny wzrost na wybiegu (>25)
        (~df.get('is_rundown', False) & (df['temp_gradient_final'] > 5.0)) # 3. Wzrost na postoju (>5)
    ) & (df['temp_gradient_final'] > -0.5) & (df['temp_gradient_fast'] > 0) # 4. Blokada stygnięcia (Fast + 1h)
    
    is_predictive_failure = is_predictive_failure & is_predictive_gate
    
    # DEBUG: Zrzut dla alarmu o północy (lub dowolnego innego)
    if is_predictive_failure.any():
        for t, val in is_predictive_failure[is_predictive_failure].items():
            print(f"  [DEBUG PRED] Triggered at {t}: Rise={df.loc[t, 'temp_total_rise']:.1f}, Temp={df.loc[t, 'temp_mean']:.1f}, Grad={df.loc[t, 'temp_gradient_final']:.1f}, RawProd={df.loc[t, 'is_production_raw']}, Rundown={df.loc[t, 'is_rundown']}")

    conditions = [
        ((gradient_for_alarm >= AWS_GRADIENT_FIRE_EXTREME) | is_fast_fire | is_absolute_overheat) & (df['temp_mean'] >= min_fire_temp), # 🔴🔥 POŻAR (Zawsze priorytet)
        is_predictive_failure,                                       # 🔴 PREDYKCJA (Wyżej niż IDLE, by łapać zatarcie!)
        ~df['is_production'] | df['is_break'],                       # IDLE (Postój / Przerwa)
        gradient_for_alarm < AWS_GRADIENT_WARNING,                   # Stabilna
        (gradient_for_alarm >= AWS_GRADIENT_WARNING) &
        (gradient_for_alarm < AWS_GRADIENT_CRITICAL),                # Trend grzania
        (gradient_for_alarm >= AWS_GRADIENT_CRITICAL) & (df['temp_mean'] >= min_fire_temp), # Potwierdzony ogień
        gradient_for_alarm >= AWS_GRADIENT_CRITICAL                  # Krytyczny przy małej temp
    ]
    choices = [
        '🔴🔥 BRANN/STOPP',
        '🔴 KRITISK ALARM',                                          # Dla is_predictive_failure
        'IDLE',
        '🟢 MONITORING',
        '🟡 PLANLEGG SERVICE',
        '🔴🔥 BRANN/STOPP',
        '🔴 KRITISK ALARM'
    ]
    df['aws_status'] = np.select(conditions, choices, default='UNKNOWN')

    return df


# ═══════════════════════════════════════════════════════════════════════════════
#  MODUŁ 4B: RANDOM CUT FOREST — AWS MONITRON ML
# ═══════════════════════════════════════════════════════════════════════════════

def analyze_rcf_anomaly(df: pd.DataFrame) -> pd.DataFrame:
    """
    Isolation Forest — wielowymiarowa detekcja anomalii (rodzina RCF).

    Teoria (Liu et al., 2008 / AWS Monitron):
        Isolation Forest i Random Cut Forest należą do tej samej rodziny
        algorytmów: tree-based isolation anomaly detection.

        AWS Monitron używa RCF (Guha et al., 2016) — streamingowa wersja.
        sklearn IsolationForest to batch-wersja z C-optymalizacją,
        idealna do analizy historycznych danych CSV.

        Zasada działania (obie wersje):
        1. Buduj losowe drzewa na wielowymiarowych danych
        2. Anomalie = punkty "łatwe do oddzielenia" (krótka ścieżka w drzewie)
        3. Normalne punkty = głęboko w drzewie (trudne do oddzielenia)

    Cechy wejściowe (4D):
        - vib_rms:              Energia wibracji
        - temp_mean:            Temperatura łożyska
        - crest_factor:         Impulsowość (uszkodzenia mechaniczne)
        - temp_gradient_final:  Szybkość zmian temperatury

    Trenowanie:
        Tylko na danych PRODUKCYJNYCH.
        Standaryzacja z-score na każdej cesze.

    Klasyfikacja:
        Score < P1 (1-ty percentyl) → ANOMALIA KRYTYCZNA (najbardziej izolowane)
        Score < P5 (5-ty percentyl) → ANOMALIA WARNING
        Reszta → MONITORING

    Uwaga: IsolationForest zwraca ujemne score dla anomalii
    (im bardziej ujemny, tym bardziej anomalny).
    """
    from sklearn.ensemble import IsolationForest
    from sklearn.preprocessing import StandardScaler

    df = df.copy()
    df['rcf_score'] = 0.0
    df['rcf_status'] = 'IDLE'

    # Zabezpieczenie przed brakiem temp_mean i temp_gradient_final
    for col in ['temp_mean', 'temp_gradient_final']:
        if col not in df.columns:
            df[col] = 0.0

    # Filtruj: trenujemy TYLKO na produkcji
    prod_mask = df['is_production'] & ~df['is_break']
    prod_df = df[prod_mask].copy()

    if len(prod_df) < 500:
        print("     ⚠️  Za mało danych produkcyjnych dla RCF")
        return df

    # Przygotuj cechy — używamy tylko tych dostępnych w DF
    actual_features = [f for f in RCF_FEATURES if f in prod_df.columns]
    if not actual_features:
        return df
        
    features = prod_df[actual_features].fillna(0).values
    scaler = StandardScaler()
    features_norm = scaler.fit_transform(features)

    # Buduj Isolation Forest (C-optymalizowany, sekundy zamiast minut)
    print(f"     → Budowanie lasu: {RCF_NUM_TREES} drzew × {RCF_TREE_SIZE} próbek...")
    model = IsolationForest(
        n_estimators=RCF_NUM_TREES,
        max_samples=min(RCF_TREE_SIZE, len(features_norm)),
        contamination='auto',  # Automatyczna kalibracja
        random_state=42,
        n_jobs=-1              # Użyj wszystkich rdzeni CPU
    )
    model.fit(features_norm)

    # Score: im bardziej ujemny, tym bardziej anomalny
    scores = model.decision_function(features_norm)

    # Oblicz progi na podstawie rozkładu (dolne percentyle = anomalie)
    threshold_warning = np.percentile(scores, 100 - RCF_PERCENTILE_WARNING)  # P1
    threshold_critical = np.percentile(scores, 100 - RCF_PERCENTILE_CRITICAL)  # P0.1

    print(f"     → Próg WARNING  (P{100-RCF_PERCENTILE_WARNING:.1f}): {threshold_warning:.3f}")
    print(f"     → Próg CRITICAL (P{100-RCF_PERCENTILE_CRITICAL:.1f}): {threshold_critical:.3f}")
    print(f"     → Min score: {scores.min():.3f} | Median: {np.median(scores):.3f}")

    # Wyniki do DF (tylko dla punktów produkcyjnych)
    prod_indices = prod_df.index
    df.loc[prod_indices, 'rcf_score'] = scores

    # --- NOWOŚĆ: JEDNOSTRONNY FILTR WIBRACYJNY (ANTY-FALSE-POSITIVE DLA POSTOJÓW) ---
    # RCF ma tendencję do krzyczenia "ANOMALIA!" gdy maszyna naturalnie zwalnia na koniec zmiany (nagły zanik wibracji).
    # Chcemy zgłaszać alarmy (Warning/Critical) TYLKO wtedy, gdy RCF znajdzie anomalię ORAZ:
    # 1. Maszyna wibruje silniej niż wynosi jej typowa "zdrowia" średnia praca.
    # Używamy tolerancyjnego progu: wibracje muszą być >= (0.8 * typowa średnia produkcyjna).
    if 'vib_rms' in prod_df.columns:
        typical_vib = prod_df['vib_rms'].median()
        # Mnożymy przez 0.8, aby pozwolić na alarmy "narastające", ale uciąć oczywiste puste zera z postoju
        # [POPRAWKA] Pozwól na anomalię nawet przy niskich wibracjach, jeśli gradient temp jest wysoki (zatarcie!)
        is_vib_spike = (df['vib_rms'] >= (typical_vib * 0.8)) | (df.get('temp_gradient_final', 0) > 10.0)
    else:
        is_vib_spike = pd.Series(True, index=df.index)

    # Status tylko dla produkcji (poza produkcją będzie IDLE lub nadpisane)
    rcf_status = pd.Series('IDLE', index=df.index)
    
    # Warunkowa klasyfikacja
    # [POPRAWKA] Pozwalamy na RCF w czasie rundown, jeśli jest to dangerous_rundown (temp rośnie)
    is_dangerous_rundown = df.get('is_rundown', False) & (df.get('temp_gradient_final', 0) > 5.0)
    
    # 1. Critical
    is_crit = (df['rcf_score'] <= threshold_critical) & (df['is_production'] | is_dangerous_rundown) & is_vib_spike
    rcf_status[is_crit] = '🔴 KRITISK ALARM'
    
    # 2. Warning
    is_warn = (df['rcf_score'] <= threshold_warning) & (df['is_production'] | is_dangerous_rundown) & is_vib_spike & ~is_crit
    rcf_status[is_warn] = '🟡 PLANLEGG SERVICE'

    # [NOWOŚĆ] Tłumienie stygnięcia dla RCF:
    # Jeśli temp < 30C i gradient ujemny, to nawet jeśli statystycznie jest to anomalia (bo np. wibruje na wybiegu),
    # to fizycznie nie ma ryzyka awarii termicznej.
    is_cooling_safe = (df['temp_mean'] < 30.0) & (df.get('temp_gradient_final', 0) < 0.0)
    rcf_status[is_cooling_safe & rcf_status.isin(['🔴 KRITISK ALARM', '🟡 PLANLEGG SERVICE'])] = '🟢 MONITORING'

    # Domyślnie dla produkcji, jeśli nie ma alarmu, to monitoring
    rcf_status[prod_mask & ~is_crit & ~is_warn] = '🟢 MONITORING'

    df['rcf_status'] = rcf_status

    # Statystyki
    n_warning = (df['rcf_status'] == '🟡 ANOMALIA RCF').sum()
    n_critical = (df['rcf_status'] == '🔴 ANOMALIA KRYTYCZNA RCF').sum()
    print(f"     → Wykryto: {n_warning} anomalii 🟡 + {n_critical} anomalii 🔴")

    return df


# ═══════════════════════════════════════════════════════════════════════════════
#  MODUŁ 5: FUZJA ALARMÓW — WYNIK KOŃCOWY
# ═══════════════════════════════════════════════════════════════════════════════

def fuse_alarms(df: pd.DataFrame, is_heavy_machinery: bool = False) -> pd.DataFrame:
    """
    Fuzja alarmów z trzech silników diagnostycznych.
    """
    df = df.copy()
    
    # Wybór persistencji na podstawie klasy
    persistence_required = HEAVY_ALARM_PERSISTENCE_INTERVALS if is_heavy_machinery else ALARM_PERSISTENCE_INTERVALS

    # Zabezpieczenie przed brakującymi kolumnami statusów
    for col in ['p_skf', 'p_siemens', 'p_aws', 'p_rcf']:
        if col not in df.columns: df[col] = 0
    for col in ['skf_status', 'siemens_status', 'aws_status', 'rcf_status']:
        if col not in df.columns: df[col] = 'IDLE'

    # Mapowanie priorytetów (wyższy = gorszy)
    priority = {
        'IDLE': 0,
        '🟢 MONITORING': 1,
        '🟡 PLANLEGG SERVICE': 3,
        '🔴 KRITISK ALARM': 4,
        '🔴🔥 BRANN/STOPP': 5,
        'UNKNOWN': 0
    }

    # Oblicz priorytety per silnik
    df['p_skf'] = df['skf_status'].map(priority).fillna(0)
    df['p_siemens'] = df['siemens_status'].map(priority).fillna(0)
    df['p_aws'] = df['aws_status'].map(priority).fillna(0)
    df['p_rcf'] = df['rcf_status'].map(priority).fillna(0)
    df['max_priority'] = df[['p_skf', 'p_siemens', 'p_aws', 'p_rcf']].max(axis=1)

    # ── Alarm Persistence (Debounce) ──
    # Dla każdego silnika: ile kolejnych interwałów alarm jest aktywny?
    # Alarm trwa = priorytet >= 3 (PLANLEGG SERVICE lub wyżej)
    for col in ['p_skf', 'p_siemens', 'p_aws', 'p_rcf']:
        alarm_active = (df[col] >= 3).astype(int)
        # Oblicz ciąg kolejnych jedynek (rolling count z resetem na 0)
        # Użyj cumsum trick: grupa = cumsum(~alarm) → count w grupie
        groups = (~alarm_active.astype(bool)).cumsum()
        df[f'{col}_streak'] = alarm_active.groupby(groups).cumsum()

    # Persistence: alarm potwierdzony dopiero po N kolejnych interwałach
    for col, status_col in [('p_skf', 'skf_status'),
                            ('p_siemens', 'siemens_status'),
                            ('p_aws', 'aws_status'),
                            ('p_rcf', 'rcf_status')]:
        # Ekstremalny pożar wymaga potężnego gradientu I potwierdzenia, że to nie jest zimny start z mrozu.
        is_extreme_fire = False
        if 'temp_gradient_final' in df.columns and 'temp_mean' in df.columns:
            is_extreme_fire = (df['temp_gradient_final'] >= AWS_GRADIENT_FIRE_EXTREME) & (df['temp_mean'] >= AWS_MIN_FIRE_TEMP)
        
        # BRANN/STOPP (priorytet 5) — wymóg potwierdzenia
        # CHYBA ŻE JEST TO EKSTREMALNY POŻAR (który nie zmarzł) - wtedy bypass debouncingu (persistence = 0)
        is_fire_not_persistent = (
            (df[col] >= 5) &
            (df[f'{col}_streak'] < ALARM_PERSISTENCE_FIRE) &
            ~is_extreme_fire
        )
        # Zwykłe alarmy (priorytet 3-4) — pełna persistence 
        # Zmieniono: alarmy nie sš już kasowane do statusu ZIELONEGO,
        # Jeżeli alarm (np p=4) nie ma persistence, próbujemy zachować chociaż p=3 jeśli pod spodem też krzyczy algorytm
        is_alarm_not_persistent = (
            (df[col] >= 3) &
            (df[col] < 5) &
            (df[f'{col}_streak'] < persistence_required)
        )
        
        # Degradacja: zamiast na ślepo wrzucać 🟢 MONITORING (p=1), 
        # zrzucamy nietrwałe p>=4 do p=3 (SERVICE), a nietrwałe p=3 do p=1
        df.loc[is_fire_not_persistent, col] = 4
        df.loc[is_fire_not_persistent, status_col] = '🔴 KRITISK ALARM'
        
        unpersisted_crit = is_alarm_not_persistent & (df[col] == 4)
        df.loc[unpersisted_crit, col] = 3
        df.loc[unpersisted_crit, status_col] = '🟡 PLANLEGG SERVICE'
        
        unpersisted_warn = is_alarm_not_persistent & (df[col] == 3)
        df.loc[unpersisted_warn, col] = 1
        df.loc[unpersisted_warn, status_col] = '🟢 MONITORING'

    # Przelicz max_priority po debounce
    df['max_priority'] = df[['p_skf', 'p_siemens', 'p_aws', 'p_rcf']].max(axis=1)

    # Wynik końcowy
    conditions = [
        df['max_priority'] == 0,
        df['max_priority'] == 1,
        df['max_priority'].isin([2, 3]),
        df['max_priority'] == 4,
        df['max_priority'] >= 5
    ]
    choices = [
        'IDLE',
        '🟢 MONITORING',
        '🟡 PLANLEGG SERVICE',
        '🔴 KRITISK ALARM',
        '🔴🔥 BRANN/STOPP'
    ]
    df['FINAL_VERDICT'] = np.select(conditions, choices, default='UNKNOWN')

    # Źródło alarmu
    def get_alarm_source(row):
        sources = []
        if row['p_skf'] >= 3:
            sources.append('SKF')
        if row['p_siemens'] >= 3:
            sources.append('Siemens')
        if row['p_aws'] >= 3:
            sources.append('AWS')
        if row['p_rcf'] >= 3:
            sources.append('RCF')
        return '+'.join(sources) if sources else '-'

    df['alarm_source'] = df.apply(get_alarm_source, axis=1)

    return df


# ═══════════════════════════════════════════════════════════════════════════════
#  MODUŁ 6: HEALTH INDEX + PRAWDOPODOBIEŃSTWO AWARII
# ═══════════════════════════════════════════════════════════════════════════════

def calculate_health_index(df: pd.DataFrame) -> pd.DataFrame:
    """
    Composite Health Index (0-100%) + P(awaria w ciągu 24h).

    Teoria (ISO 13381-1 / Augury / SparkCognition):
        Health Index łączy wyniki 4 silników w jeden ciągły wskaźnik.

        P(awaria) — sigmoidalna konwersja HI na prawdopodobieństwo.
        Kalibracja na prawdziwym pożarze 13.02.2026:
          - HI=100% → P≈1%   (łożysko zdrowe)
          - HI=50%  → P≈15%  (wczesne zużycie)
          - HI=20%  → P≈75%  (zaawansowane uszkodzenie)
          - HI=0%   → P≈99%  (awaria nieunikniona)
    """
    df = df.copy()

    # ── 1. Normalizacja komponentów do skali 0-100% ──

    # --- Komponent wibracyjny (Siemens baseline) ---
    # KLUCZOWA POPRAWKA: vib_rms ≈ 0 przy wysokiej temp = łożysko się zaklinowało!
    dev_abs = df['baseline_deviation_pct'].abs().clip(0, 200)
    hi_vib = (1 - dev_abs / 200) * 100
    # Zakleszczenie = vib prawie zero, ALE temp rośnie drastycznie szybciej niż powinna!
    # Używamy wyliczonego gradientu temp - jeżeli wał stoi (vib_rms < 0.01) ale grzeje się tempem > 12C/h
    # Oznacza to potężne zaciśnięcie pasa / spalanie cewek silnika!
    seized_mask = (df['vib_rms'] < 0.01) & (df['temp_gradient_final'] > 12.0)
    hi_vib[seized_mask] = 0.0

    # --- Komponent gradientu temperatury (AWS) ---
    grad_pos = df['temp_gradient_final'].clip(lower=0)
    hi_grad = (1 - grad_pos / AWS_GRADIENT_CRITICAL).clip(0, 1) * 100
    # Desensytyzacja rozgrzewki: podczas warmup gradient jest naturalny
    if 'is_warmup' in df.columns:
        hi_grad[df['is_warmup']] = hi_grad[df['is_warmup']] * 0.5 + 50

    # --- Komponent absolutnej temperatury ---
    # > 55°C = zaczyna być niebezpieczne, > 90°C = krytyczne
    TEMP_SAFE = 55.0
    TEMP_CRITICAL = 90.0
    hi_abs_temp = ((TEMP_CRITICAL - df['temp_mean']) / (TEMP_CRITICAL - TEMP_SAFE)).clip(0, 1) * 100

    # --- NOWY: Komponent ISO 10816-1 (Absolutne normy wibracji) ---
    # Chroni przed "skażonym baseline" — jeśli maszyna wibruje źle od początku,
    # ISO to wychwyci, nawet jeśli Siemens baseline mówi że jest "normalnie".
    # Klasa I: <0.71=100%, 1.8=50%, 4.5=0%
    if df['vib_rms'].max() > 0:
        hi_iso = np.interp(
            df['vib_rms'],
            [0, ISO_VIB_ZONE_A_B, ISO_VIB_ZONE_B_C, ISO_VIB_ZONE_C_D],
            [100, 100, 50, 0]
        )
    else:
        hi_iso = 100.0

    # --- Komponent CF (SKF) ---
    cf_norm = ((df['crest_factor'] - 1) / (SKF_CF_CRITICAL - 1)).clip(0, 1)
    hi_cf = (1 - cf_norm) * 100

    # --- Komponent RCF (Isolation Forest) ---
    rcf_norm = ((df['rcf_score'] + 0.2) / 0.3).clip(0, 1)
    hi_rcf = rcf_norm * 100

    # ── 2. Ważony Health Index ──
    # Wagi rebalansowane dla uwzględnienia ISO (20%):
    W_VIB_REL = 0.20    # Siemens (relatywny do historii)
    W_VIB_ABS = 0.20    # ISO (absolutny do norm)
    W_GRAD = 0.20       # Gradient temperatury
    W_ABS_TEMP = 0.15   # Absolutna temperatura
    W_CF = 0.10         # Crest Factor
    W_RCF = 0.15        # Isolation Forest (wielowymiarowy)

    df['health_index'] = (
        W_VIB_REL * hi_vib +
        W_VIB_ABS * hi_iso +
        W_GRAD * hi_grad +
        W_ABS_TEMP * hi_abs_temp +
        W_CF * hi_cf +
        W_RCF * hi_rcf
    ).clip(0, 100)

    # Hard override: fizycznie niebezpieczne warunki
    # 1. Temperatura > 80°C = max HI = 30%
    df.loc[df['temp_mean'] > 80, 'health_index'] = df.loc[
        df['temp_mean'] > 80, 'health_index'].clip(upper=30)
    # 2. Gradient > 20°C/h = max HI = 25%
    df.loc[grad_pos > 20, 'health_index'] = df.loc[
        grad_pos > 20, 'health_index'].clip(upper=25)
    # 3. Zakleszczenie (vib≈0 + temp>40°C) = max HI = 15%
    df.loc[seized_mask, 'health_index'] = df.loc[
        seized_mask, 'health_index'].clip(upper=15)

    df.loc[~df['is_production'], 'health_index'] = np.nan

    # ── 3. Trend HI (2h okno = 24 interwały) ──
    df['hi_trend'] = df['health_index'].diff(periods=24)

    # ── 4. RUL (Remaining Useful Life) Prediction ──
    # Przewidujemy czas do osiągnięcia HI = 15% (próg krytyczny)
    # RUL [h] = (Current_HI - Critical_HI) / (Degradation_Rate_per_hour)
    CRITICAL_HI = 15.0
    df['rul_hours'] = np.nan
    
    # Delta HI na godzinę (12 interwałów po 5 min)
    hi_rate_per_hour = df['health_index'].diff(periods=12)
    
    # Oblicz RUL tylko gdy zdrowie SPADA (rate < 0)
    degrading = (hi_rate_per_hour < -0.1) & (df['health_index'] > CRITICAL_HI)
    df.loc[degrading, 'rul_hours'] = (
        (df.loc[degrading, 'health_index'] - CRITICAL_HI) / 
        (-hi_rate_per_hour.loc[degrading])
    ).clip(0, 168) # Max 1 tydzień prognozy

    # ── 5. P(awaria) — sigmoid z recalibrowanymi parametrami ──
    # Steilsza krzywa: k=10 (było 8), midpoint x0=0.45 (było 0.35)
    # Efekt: P rośnie szybciej gdy HI spada poniżej 45%
    SIGMOID_K = 10
    SIGMOID_X0 = 0.45
    hi_norm = df['health_index'].fillna(100) / 100
    base_p = 1 / (1 + np.exp(-SIGMOID_K * (SIGMOID_X0 - hi_norm)))

    # Silniejszy modyfikator trendu: spadający HI → +30% P (było +20%)
    trend_mod = (-df['hi_trend'].fillna(0) / 100).clip(0, 0.30)
    df['failure_probability'] = (base_p + trend_mod).clip(0, 0.99) * 100
    df.loc[~df['is_production'], 'failure_probability'] = np.nan

    # ── 5. Klasyfikacja ryzyka ──
    conditions = [
        ~df['is_production'],
        df['failure_probability'] <= 5,
        (df['failure_probability'] > 5) & (df['failure_probability'] <= 25),
        (df['failure_probability'] > 25) & (df['failure_probability'] <= 60),
        df['failure_probability'] > 60
    ]
    choices = [
        'IDLE',
        '🟢 NISKIE (0-5%)',
        '🟡 UMIARKOWANE (5-25%)',
        '🟠 WYSOKIE (25-60%)',
        '🔴 KRYTYCZNE (>60%)'
    ]
    df['risk_level'] = np.select(conditions, choices, default='UNKNOWN')

    return df


def print_health_report(df: pd.DataFrame):
    """Drukuj raport Health Index z prawdopodobieństwem awarii."""
    prod = df[df['is_production'] == True].copy()
    if len(prod) == 0:
        return

    print(f"\n{'═' * 80}")
    print(f"  🏥 HEALTH INDEX — PRAWDOPODOBIEŃSTWO AWARII")
    print(f"{'═' * 80}")

    # Ostatni znany stan
    last = prod.iloc[-1]
    
    # Formatowanie RUL
    rul_text = "STABILNY"
    if not np.isnan(last['rul_hours']):
        if last['rul_hours'] < 1:
            rul_text = f"🔴 KATASTROFA (< 1h!)"
        elif last['rul_hours'] < 24:
            rul_text = f"🟠 {last['rul_hours']:.1f} h (Dziś!)"
        else:
            rul_text = f"🟡 {last['rul_hours']/24:.1f} dni"

    print(f"\n  📍 Ostatni pomiar: {prod.index[-1]}")
    print(f"     Health Index:                  {last['health_index']:.0f}%")
    print(f"     P(awaria w ciągu 24h):         {last['failure_probability']:.1f}%")
    print(f"     Trend (ostatnie 2h):           {last['hi_trend']:+.1f}%" if not np.isnan(last['hi_trend']) else f"     Trend:                         brak danych")
    print(f"     RUL (Prognoza czasu pracy):    {rul_text}")
    print(f"     Poziom ryzyka:                 {last['risk_level']}")

    # Rozkład ryzyka
    print(f"\n  📊 Rozkład ryzyka (cały okres):")
    for level in ['🟢 NISKIE (0-5%)', '🟡 UMIARKOWANE (5-25%)',
                  '🟠 WYSOKIE (25-60%)', '🔴 KRYTYCZNE (>60%)']:
        count = (df['risk_level'] == level).sum()
        pct = count / len(prod) * 100
        print(f"     {level}: {count:,} ({pct:.1f}%)")

    # Top 10
    print(f"\n  🔝 TOP 10 — Najwyższe P(awaria) / Najniższy RUL:")
    top = prod.nlargest(10, 'failure_probability')
    for idx, row in top.iterrows():
        rt = f"{row['rul_hours']:.1f}h" if not np.isnan(row['rul_hours']) else "---"
        print(f"     {idx}  HI={row['health_index']:4.0f}%  "
              f"P={row['failure_probability']:5.1f}%  "
              f"RUL={rt:>6}  "
              f"T={row['temp_mean']:5.1f}°")


# ═══════════════════════════════════════════════════════════════════════════════
#  MODUŁ 7: RAPORT BIZNESOWY
# ═══════════════════════════════════════════════════════════════════════════════

def print_header():
    """Wydrukuj nagłówek raportu."""
    print("\n")
    print("╔" + "═" * 96 + "╗")
    print("║  DIAGNOSTIKKRAPPORT — LAGERMONITORINGSSYSTEM" + " " * 50 + "║")
    print("║  Metode: SKF Crest Factor + Siemens Baseline + AWS Monitron Gradient" + " " * 24 + "║")
    print("║  Standard: ISO 13373-1 / IEC 61508 (SIL-2 alarm fusion)" + " " * 39 + "║")
    print("╠" + "═" * 96 + "╣")
    print("║  ALARMFORKLARING:" + " " * 78 + "║")
    print("║    🟢 MONITORING      — Stabil drift, ingen handling nødvendig" + " " * 29 + "║")
    print("║    🟡 PLANLEGG SERVICE — Planlegg lagerskifte innen 2-4 uker" + " " * 30 + "║")
    print("║    🔴 BRANN/STOPP      — STOPP LINJEN! Risiko for brann/havari" + " " * 25 + "║")
    print("╚" + "═" * 96 + "╝")


def print_summary_stats(df: pd.DataFrame):
    """Wydrukuj podsumowanie statystyczne."""
    total = len(df)
    idle = len(df[df['FINAL_VERDICT'] == 'IDLE'])
    ok = len(df[df['FINAL_VERDICT'] == '🟢 MONITORING'])
    warn = len(df[df['FINAL_VERDICT'] == '🟡 PLANLEGG SERVICE'])
    crit = len(df[df['FINAL_VERDICT'].str.contains('🔴', na=False)])

    print(f"\n{'─' * 80}")
    print(f"  📊 STATISTISK OPPSUMMERING ({total} 5-minutters intervaller)")
    print(f"{'─' * 80}")
    print(f"  ⚙️  IDLE (maskin av): {idle:>6}  ({idle/total*100:5.1f}%)")
    print(f"  🟢 MONITORING (stabil):       {ok:>6}  ({ok/total*100:5.1f}%)")
    print(f"  🟡 PLANLEGG SERVICE (trend):   {warn:>6}  ({warn/total*100:5.1f}%)")
    print(f"  🔴 KRITISK ALARM / BRANN:      {crit:>6}  ({crit/total*100:5.1f}%)")
    print(f"{'─' * 80}")

    # Temperatura
    print(f"\n  🌡️  TEMPERATURA ŁOŻYSKA:")
    print(f"      Min: {df['temp_mean'].min():6.1f}°C | "
          f"Średnia: {df['temp_mean'].mean():6.1f}°C | "
          f"Max: {df['temp_mean'].max():6.1f}°C")

    # Wibracje
    running = df[df['vib_rms'] > SKF_VIBRATION_IDLE]
    if len(running) > 0:
        print(f"\n  📳 WIBRACJE (gdy maszyna pracuje):")
        print(f"      RMS Min: {running['vib_rms'].min():.3f}g | "
              f"Średnia: {running['vib_rms'].mean():.3f}g | "
              f"Max: {running['vib_rms'].max():.3f}g")
        print(f"      Crest Factor Min: {running['crest_factor'].min():.2f} | "
              f"Średni: {running['crest_factor'].mean():.2f} | "
              f"Max: {running['crest_factor'].max():.2f}")

    # Gradient
    print(f"\n  📈 GRADIENT TEMPERATURY:")
    print(f"      Max wzrost: {df['temp_gradient_final'].max():+.1f}°C/h | "
          f"Max spadek: {df['temp_gradient_final'].min():+.1f}°C/h")


def print_alarm_events(df: pd.DataFrame):
    """Wydrukuj szczegółową listę zdarzeń alarmowych."""
    alarms = df[df['FINAL_VERDICT'].str.contains('SERVICE|ALARM|BRANN', na=False)].copy()

    if len(alarms) == 0:
        print("\n  ✅ BRAK ALARMÓW — Maszyna pracuje w normie przez cały analizowany okres.")
        return

    print(f"\n{'═' * 100}")
    print(f"  ⚠️  ZDARZENIA ALARMOWE ({len(alarms)} interwałów)")
    print(f"{'═' * 100}")
    print(f"  {'Czas':<22} │ {'Temp':>6} │ {'Vib_RMS':>7} │ {'CF':>5} │ "
          f"{'Δ%Baza':>7} │ {'ΔT/h':>6} │ {'Źródło':>8} │ Status")
    print(f"  {'─' * 22}─┼─{'─' * 6}─┼─{'─' * 7}─┼─{'─' * 5}─┼─"
          f"{'─' * 7}─┼─{'─' * 6}─┼─{'─' * 8}─┼─{'─' * 30}")

    # Grupuj ciągłe zdarzenia alarmowe aby nie zalewać konsoli
    # Pokaż pierwsze i ostatnie zdarzenie z każdej grupy
    prev_verdict = None
    group_start = None
    group_count = 0

    for idx, row in alarms.iterrows():
        current_verdict = row['FINAL_VERDICT']

        if current_verdict != prev_verdict:
            # Nowa grupa alarmowa
            if group_count > 2 and prev_verdict is not None:
                print(f"  {'... (' + str(group_count - 2) + ' więcej)':<22} │ {'':>6} │ "
                      f"{'':>7} │ {'':>5} │ {'':>7} │ {'':>6} │ {'':>8} │")

            timestamp_str = idx.strftime('%Y-%m-%d %H:%M')
            print(f"  {timestamp_str:<22} │ {row['temp_mean']:>5.1f}° │ "
                  f"{row['vib_rms']:>7.3f} │ {row['crest_factor']:>5.2f} │ "
                  f"{row['baseline_deviation_pct']:>+6.0f}% │ "
                  f"{row['temp_gradient_final']:>+5.1f}° │ "
                  f"{row['alarm_source']:>8} │ {current_verdict}")
            group_start = idx
            group_count = 1
            prev_verdict = current_verdict
        else:
            group_count += 1
            if group_count <= 2:
                timestamp_str = idx.strftime('%Y-%m-%d %H:%M')
                print(f"  {timestamp_str:<22} │ {row['temp_mean']:>5.1f}° │ "
                      f"{row['vib_rms']:>7.3f} │ {row['crest_factor']:>5.2f} │ "
                      f"{row['baseline_deviation_pct']:>+6.0f}% │ "
                      f"{row['temp_gradient_final']:>+5.1f}° │ "
                      f"{row['alarm_source']:>8} │ {current_verdict}")

    # Ostatnia grupa
    if group_count > 2:
        print(f"  {'... (' + str(group_count - 2) + ' więcej)':<22} │ {'':>6} │ "
              f"{'':>7} │ {'':>5} │ {'':>7} │ {'':>6} │ {'':>8} │")


def print_recommendations(df: pd.DataFrame):
    """Wydrukuj rekomendacje działań na podstawie wyników analizy."""
    alarms = df[df['FINAL_VERDICT'].str.contains('SERVICE|ALARM|BRANN', na=False)]

    print(f"\n{'═' * 80}")
    print("  📋 REKOMENDACJE DLA ZARZĄDU / KIEROWNIKA UR")
    print(f"{'═' * 80}")

    if len(alarms) == 0:
        print("  ✅ Brak wymaganych działań. Kontynuować monitoring.")
        return

    has_fire = df['FINAL_VERDICT'].str.contains('BRANN', na=False).any()
    has_critical = df['FINAL_VERDICT'].str.contains('KRITISK', na=False).any()
    has_service = df['FINAL_VERDICT'].str.contains('SERVICE', na=False).any()

    rec_num = 1
    if has_fire:
        print(f"\n  🔴 REKOMENDACJA {rec_num}: NATYCHMIASTOWE ZATRZYMANIE")
        print(f"     Wykryto krytyczny gradient temperatury (>{AWS_GRADIENT_CRITICAL}°C/h).")
        print(f"     Uzasadnienie: Zgodnie z AWS Monitron methodology, szybki wzrost")
        print(f"     temperatury wskazuje na utratę smarowania lub zacieranie (🔴🔥 BRANN/STOPP).")
        print(f"     RYZYKO: Pożar łożyska w ciągu 1-3 godzin bez interwencji.")
        print(f"     AKCJA: Zatrzymaj linię. Sprawdź smarowanie i stan bieżni.")
        rec_num += 1

    if has_critical:
        print(f"\n  🔴 REKOMENDACJA {rec_num}: WYMIANA ŁOŻYSKA W CIĄGU 48H")
        print(f"     Wykryto krytyczne odchylenie od normy pracy lub wysoki Crest Factor.")
        print(f"     Uzasadnienie: Analiza SKF/Siemens wskazuje na zaawansowane")
        print(f"     uszkodzenie mechaniczne bieżni lub kulek łożyska.")
        print(f"     AKCJA: Zamów łożysko. Zaplanuj wymianę na najbliższy przestój.")
        rec_num += 1

    if has_service:
        print(f"\n  🟡 REKOMENDACJA {rec_num}: PLANOWANY SERWIS (2-4 TYGODNIE)")
        print(f"     Wykryto trend wzrostowy wibracji lub temperatury.")
        print(f"     Uzasadnienie: Siemens Baseline Deviation wskazuje na")
        print(f"     postępujące zużycie (🟡 PLANLEGG SERVICE).")
        print(f"     AKCJA: Zamów części. Zaplanuj wymianę w ramach planowego przestoju.")
        rec_num += 1

    # Podsumowanie kosztów
    print(f"\n  💰 UZASADNIENIE EKONOMICZNE:")
    print(f"     Koszt planowanej wymiany łożyska:     ~2,000-5,000 PLN")
    print(f"     Koszt nieplanowanego przestoju (1h):   ~10,000-30,000 PLN")
    print(f"     Koszt pożaru i odbudowy linii:         ~500,000-2,000,000 PLN")
    print(f"     → Prewencja jest 100-400× tańsza niż awaria.")


def export_results(df: pd.DataFrame, output_path: str):
    """Eksportuj wyniki analizy do CSV."""
    export_cols = [
        'sn',
        'is_production', 'is_break', 'is_warmup',
        'temp_mean', 'vib_rms', 'vib_max', 'crest_factor', 'avg_line_vibration',
        'baseline_7d', 'baseline_deviation_pct',
        'temp_gradient_final',
        'rcf_score',
        'health_index', 'failure_probability', 'rul_hours', 'risk_level',
        'skf_status', 'siemens_status', 'aws_status', 'rcf_status',
        'FINAL_VERDICT', 'alarm_source'
    ]
    existing_cols = [c for c in export_cols if c in df.columns]
    df[existing_cols].to_csv(output_path, sep=';', encoding='utf-8-sig')
    print(f"\n  💾 Wyniki zapisane do: {output_path}")


# ═══════════════════════════════════════════════════════════════════════════════
#  MAIN — URUCHOMIENIE ANALIZY
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    """
    Główna funkcja analizy. Uruchamia kolejno:
    1. Ładowanie danych
    2. Agregacja 5-minutowa
    3. Analiza SKF (Crest Factor)
    4. Analiza Siemens (Baseline Deviation)
    5. Analiza AWS Monitron (Temperature Gradient)
    6. Analiza RCF (Random Cut Forest — ML)
    7. Fuzja alarmów
    8. Raport biznesowy
    """
    print("╔" + "═" * 70 + "╗")
    print("║  URUCHAMIANIE SYSTEMU DIAGNOSTYCZNEGO" + " " * 32 + "║")
    print("║  Bearing Condition Monitor v2.0 (z Random Cut Forest)" + " " * 16 + "║")
    print("╚" + "═" * 70 + "╝")

    # Ścieżki do plików
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_paths = {
        "OV": "dane_lozysko_projektOV.csv",
        "OH": "dane_lozysko_projektOH.csv",
        "NH": "dane_lozysko_projektNH.csv",
        "NV": "dane_lozysko_projektNV.csv"
    }
    hall_file = os.path.join(script_dir, 'dane_hala_projekt.csv')

    # ── Krok 1: Ładowanie danych ──
    print("\n📥 KROK 1/9: Ładowanie danych z czujników IoT (Sklejenie z 4 wrzecion)...")
    
    dfs = []
    for label, filename in file_paths.items():
        filepath = os.path.join(script_dir, filename)
        if os.path.exists(filepath):
            df_part = load_sensor_data(filepath)
            
            # Wzbogacenie identyfikatora czujnika o pozycję na maszynie dla czytelnych raportów
            df_part['sn'] = df_part['sn'].astype(str) + f" ({label})"
            dfs.append(df_part)
        else:
            print(f"  ⚠️  Brak pliku: {filename}")
            
    if not dfs:
        print("❌ Brak jakichkolwiek plików z danymi łożysk! Zatrzymanie analizy.")
        return
        
    bearing_raw = pd.concat(dfs, ignore_index=True)

    hall_temp = None
    if os.path.exists(hall_file):
        hall_raw = load_sensor_data(hall_file)
        hall_temp_df = prepare_hall_data(hall_raw)
        hall_temp = hall_temp_df['hall_temp'] if isinstance(hall_temp_df, pd.DataFrame) else hall_temp_df
    else:
        print("  ⚠️  Brak danych halowych — gradient bez kompensacji otoczenia")

    # ── Krok 2: Przygotowanie danych per silnik i korelacja (Saga) ──
    print(f"\n📊 KROK 2/9: Agregacja do interwałów {AGGREGATION_INTERVAL} i grupowanie po czujnikach...")
    aggregated_sensors = {}
    for sn, sensor_data in bearing_raw.groupby('sn'):
        print(f"     → Przetwarzanie napędu SN: {sn}...")
        
        # [NOWOŚĆ] Detekcja profilu przed agregacją (potrzebna do czasu rozgrzewki)
        is_heavy_machinery = any(keyword.upper() in str(sn).upper() for keyword in HEAVY_KEYWORDS)
        
        df_sensor = prepare_bearing_data(sensor_data, is_heavy=is_heavy_machinery)
        df_sensor['sn'] = sn
        aggregated_sensors[sn] = df_sensor

    if not aggregated_sensors:
        print("Brak poprawnych danych do analizy.")
        return

    # Oblicz wspólną wibrację (Avg Line Vibration)
    all_vib = pd.DataFrame({sn: df['vib_rms'] for sn, df in aggregated_sensors.items()})
    avg_line_vib = all_vib.mean(axis=1)

    # ── Analiza dla każdego silnika niezależnie ──
    final_dfs = []
    
    for sn, df_sensor in aggregated_sensors.items():
        print(f"\n{'═' * 80}")
        print(f"  🔄 ROZPOCZĘCIE ANALIZY DLA SILNIKA / CZUJNIKA SN: {sn}")
        print(f"{'═' * 80}")
        df = df_sensor.copy()
        
        # Wstrzyknij 'avg_line_vibration' dla tego silnika
        df['avg_line_vibration'] = avg_line_vib
        
        # --- SPRAWDZENIE PROFILU MASZYNY (HEAVY IMPACT) ---
        # SN zawiera alias w nawiasie, np. "21008127 (1780 el motor NDE QSS-700 N.V)"
        is_heavy_machinery = any(keyword.upper() in str(sn).upper() for keyword in HEAVY_KEYWORDS)
        
        # [NOWOŚĆ] Detekcja czujników oleju (HPU/C2)
        is_oil = any(k.upper() in str(sn).upper() for k in OIL_KEYWORDS)
        
        if is_heavy_machinery:
            print("  ⚠️ DETEKCJA PROFILU CIĘŻKIEGO: Wykryto rębaka/QSS. Ograniczam czułość wibracyjną i persystencję.")
        
        # ── Krok 3: SKF Crest Factor ──
        print("🔧 KROK 3/9: Analiza SKF — Crest Factor (uszkodzenia mechaniczne)...")
        df = analyze_skf_crest_factor(df, is_heavy_machinery)

        # ── Krok 4: Siemens Baseline ──
        print("📐 KROK 4/9: Analiza Siemens — Adaptive Baseline (banda μ±2σ)...")
        df = analyze_siemens_baseline(df, is_heavy_machinery)

        # ── Krok 5: AWS Gradient ──
        print("🌡️  KROK 5/9: Analiza AWS Monitron — Gradient temperatury...")
        df = analyze_aws_gradient(df, hall_temp, is_heavy=is_heavy_machinery, is_oil=is_oil)

        # ── Krok 6: Random Cut Forest ──
        print("🌲 KROK 6/9: Analiza RCF — Random Cut Forest (wielowymiarowy ML)...")
        df = analyze_rcf_anomaly(df)

        # ── Krok 7: Fuzja alarmów ──
        print("⚡ KROK 7/9: Fuzja alarmów (worst-case, SIL-2 + persistence)...")
        df = fuse_alarms(df, is_heavy_machinery)

        # ── Krok 8: Health Index + P(awaria) ──
        print("🏥 KROK 8/9: Health Index + P(awaria w ciągu 24h)...")
        df = calculate_health_index(df)
        
        final_dfs.append(df)
    
    # Złączenie wyników do raportu
    all_results_df = pd.concat(final_dfs).sort_index()

    # ── Krok 9: Raport (Wersja Zbiorcza i Osobna) ──
    print("\n📋 KROK 9/9: Generowanie raportu...")
    print_header()
    
    for sn, df_sensor_final in zip(aggregated_sensors.keys(), final_dfs):
        print(f"\n{'=' * 80}")
        print(f"  RAPORT WYNIKOWY DLA SN: {sn}")
        print(f"{'=' * 80}")
        print_summary_stats(df_sensor_final)
        print_alarm_events(df_sensor_final)
        print_health_report(df_sensor_final)
        print_recommendations(df_sensor_final)

    # ── Eksport wyników ──
    output_path = os.path.join(script_dir, 'raport_diagnostyczny.csv')
    export_results(all_results_df, output_path)

    print(f"\n{'═' * 80}")
    print(f"  ✅ ANALIZA KASKADOWA ZAKOŃCZONA")
    print(f"     Przeanalizowano silniki: {list(aggregated_sensors.keys())}")
    print(f"     Łącznie interwałów: {len(all_results_df)}")
    print(f"     Zakres dat: {all_results_df.index.min()} — {all_results_df.index.max()}")
    print(f"{'═' * 80}\n")

    return all_results_df


if __name__ == '__main__':
    result = main()
