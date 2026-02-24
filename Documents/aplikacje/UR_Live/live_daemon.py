import asyncio
import aiohttp
import json
import time
import os
import pandas as pd
from datetime import datetime, timedelta

# Import funkcji AI z głównego deamona
from bearing_monitor import (
    prepare_bearing_data,
    analyze_skf_crest_factor, 
    analyze_siemens_baseline,
    analyze_aws_gradient, 
    analyze_rcf_anomaly,
    fuse_alarms, 
    calculate_health_index
)

# ---------------------------------------------------------------------------
# KONFIGURACJA DAEMONA (Enterprise Streaming)
# ---------------------------------------------------------------------------
# W środowisku produkcyjnym (Siemens MindSphere / AWS Monitron) 
# demon budzi się, agreguje mikro-dane w krótkich strzałach (micro-batching)
# i podrzuca JSON Frontendowi by nie zaciąć SCADA.

# ENV SETTINGS
DATA_DIR = os.getenv("DATA_DIR", ".")
POLL_INTERVAL_SECONDS = 120 # Odświeżanie z API (zgodnie z sugestią użytkownika - 2 minuty)
WARM_HISTORY_DAYS = 60      # Ile dni wstecz pobrać przy pierwszym rozruchu (lub uzupełnić luki)
MAX_CONCURRENT_REQUESTS = 20       # Zmniejszono ze 150 -> 50 -> 20 dla unikniecia rate limit (429) przy starcie bez historii.
OUTPUT_JSON_PATH = os.path.join(DATA_DIR, "live_status.json") # Plik wyjściowy (Atomic write)
EVENT_LOG_PATH_RAW = os.path.join(DATA_DIR, "event_history_raw.json")
EVENT_LOG_PATH_COMP = os.path.join(DATA_DIR, "event_history_comp.json")
PERSISTENCE_FILE = os.path.join(DATA_DIR, "sensor_history.parquet") # Baza danych 60 dni 
TAG_FILTER = os.getenv("TAG_FILTER", "saglinje") # TYLKO te maszyny
RETENTION_DAYS = 60         # Ile dni historii trzymać w pamięci i na dysku

# API CREDS
API_KEY = os.getenv("API_KEY", "jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI=")
SYSTEM_ID = os.getenv("SYSTEM_ID", "nIwosVxCrK9RTctvb90X")
API_BASE_URL = os.getenv("API_BASE_URL", "https://api.neuronsensors.app/v2")


class HardwareState:
    def __init__(self):
        self.active_sensors = []
        self.sensor_history = {}    # { sn: DataFrame } - trzymamy 60 dni w RAM
        self.last_timestamps = {}   # { sn: last_ms }
        self.sensor_aliases = {}    # { sn: alias }
        self.live_snapshot = {}     # { sn: latest_result_dict }
        self.event_history_raw = [] # Lista zdarzeń be kompensacji
        self.event_history_comp = [] # Lista zdarzeń z kompensacją
        self.settings = {"use_hall_compensation": True}
        self.mining_progress = 100.0 # Procent przeliczania historii


async def fetch_sensor_delta(session: aiohttp.ClientSession, hwstate: HardwareState, sn: str):
    """
    Pobiera tylko DELTĘ danych od ostatniego odpytania (Micro-batch)
    """
    now_ts = int(time.time() * 1000)
    # Domyślnie bierzemy historię z WARM_HISTORY_DAYS, jeśli nie mamy nic w pamięci
    last_ts = hwstate.last_timestamps.get(sn, now_ts - WARM_HISTORY_DAYS * 24 * 60 * 60 * 1000) 
    
    all_extracted = []
    current_last_ts = last_ts
    
    # Maksymalnie 60 strzałów przy starcie
    for _ in range(60):
        chunk_to = min(current_last_ts + 15 * 24 * 60 * 60 * 1000, now_ts)
        url = f"{API_BASE_URL}/systems/{SYSTEM_ID}/devices/{sn}/samples?from={current_last_ts}&to={chunk_to}&limit=5000"
        headers = { "ApiKey": API_KEY }
        
        try:
            async with session.get(url, headers=headers, timeout=60) as response:
                if response.status != 200:
                    break
                data = await response.json()
                
                extracted = []
                if isinstance(data, list): extracted = data
                elif data and isinstance(data.get('items'), list): extracted = data['items']
                elif data and isinstance(data, dict):
                    for v in data.values():
                        if isinstance(v, list):
                            extracted = v
                            break
                
                if not extracted: break
                all_extracted.extend(extracted)
                
                # Pobierz najnowszy timestamp z paczki i ustaw jako 'from' dla kolejnej
                max_ts = current_last_ts
                for s in extracted:
                    ts = s.get('timestamp') or s.get('time')
                    if not ts: continue
                    try:
                        if isinstance(ts, (int, float)):
                            unix_ms = int(ts)
                        else:
                            unix_ms = int(pd.to_datetime(ts).timestamp() * 1000)
                        if unix_ms > max_ts: 
                            max_ts = unix_ms
                    except:
                        continue
                
                if max_ts <= current_last_ts:
                    # Jeśli nie było danych, wciąż musimy przewinąć okno czasowe do przodu
                    current_last_ts = chunk_to + 1
                elif len(extracted) < 5000:
                    # Jeśli nie wyczerpaliśmy limitu zapytania, znaczy że pobraliśmy wszystko do 'chunk_to'
                    # Skaczemy od razu do nowej epoki, żeby nie iterować próbka po próbce
                    current_last_ts = chunk_to + 1
                else:    
                    current_last_ts = max_ts + 1
                    
                if current_last_ts >= now_ts: break
        except Exception as e:
            print(f"API Fetch Error SN: {sn} na timestamp {current_last_ts} -> {e}")
            break
            
    extracted = all_extracted
    if not extracted:
        # Zapisujemy current_last_ts, nie now_ts! Jeśli API zwróci pustą listę, ale nie było błędu (dobiliśmy do now_ts), to current_last_ts będzie ~now_ts.
        # Jeśli api ucięło się przez błąd 429 lub limit 60 chunków, current_last_ts > last_ts uratuje progres, 
        # a powrót now_ts = utrata szansy na dociągnięcie reszty historii.
        hwstate.last_timestamps[sn] = current_last_ts
        return sn, pd.DataFrame()
        
    # Budujemy Dataframe (Long format)
    records = []
    
    for s in extracted:
        ts = s.get('timestamp') or s.get('time')
        if not ts: continue
        try:
            if isinstance(ts, (int, float)):
                unix_ms = int(ts)
            else:
                unix_ms = int(pd.to_datetime(ts).timestamp() * 1000)
        except:
            continue
            
        unit = s.get('unit', '')
        if 'G' in unit or 'g' in unit: unit = 'g'
        if 'C' in unit or 'c' in unit: unit = '°C'
            
        # Spróbuj formatu zagnieżdżonego
        vals = s.get('values', [])
        for v in vals:
            idx = v.get('index')
            if idx == 1:
                records.append({'timestamp': unix_ms, 'sn': sn, 'value': float(v.get('value', 0.0)), 'unit': 'g'})
            elif idx == 2:
                records.append({'timestamp': unix_ms, 'sn': sn, 'value': float(v.get('value', 0.0)), 'unit': '°C'})
                
        # Spróbuj formatu płaskiego
        if 'value' in s and not vals:
            records.append({
                'timestamp': unix_ms,
                'sn': sn,
                'value': float(s.get('value', 0.0)),
                'unit': unit
            })
        
    df_delta = pd.DataFrame(records)
    if not df_delta.empty:
        df_delta.sort_values('timestamp', inplace=True)
        
    hwstate.last_timestamps[sn] = current_last_ts
    return sn, df_delta


def run_ai_inference(hwstate: HardwareState, sn: str, delta_df: pd.DataFrame = None):
    """
    Kalkulacja w czasie rzeczywistym.
    Jeśli delta_df jest None, odświeża snapshot na podstawie istniejącej historii.
    """
    # 1. Dolaczamy Delte do historii (jeśli przekazano)
    if delta_df is not None and not delta_df.empty:
        if sn not in hwstate.sensor_history or hwstate.sensor_history[sn].empty:
            hwstate.sensor_history[sn] = delta_df
        else:
            hwstate.sensor_history[sn] = pd.concat([hwstate.sensor_history[sn], delta_df], ignore_index=True)
        
    df_context = hwstate.sensor_history.get(sn, pd.DataFrame())
    
    # [OPTYMALIZACJA] Jeśli tylko odświeżamy snapshot (delta_df is None),
    # bierzemy tylko końcówkę historii (np. 1000 próbek), by nie przeliczać 60 dni na starcie.
    if delta_df is None and len(df_context) > 1000:
        df_context = df_context.tail(1000)
        
    # Bezpiecznik: Potrzebujemy chociaż 1 punktu by cokolwiek wyświetlić
    if df_context.empty:
        return
        
    try:
        # 1. Przygotowanie danych (Konwersja na Datetime i Agregacja 5-min wg standardu b.monitor)
        df_raw = df_context.copy()
        # Upewniamy się, że timestamp to Datetime w strefie lokalnej (Europe/Warsaw)
        # API zwraca UTC, a my operujemy na czasie lokalnym (06:00 start zmiany itp.)
        df_raw['timestamp'] = pd.to_datetime(df_raw['timestamp'], unit='ms').dt.tz_localize('UTC').dt.tz_convert('Europe/Warsaw').dt.tz_localize(None)
        
        # 2. Uruchomienie standardowego rurociągu przygotowawczego (Resample, Agg, Production Classify)
        # To załatwi nam 'vib_max', 'vib_rms', 'temp_mean' i poprawny DatetimeIndex
        df = prepare_bearing_data(df_raw)
        
        if df.empty:
            return

        # 3. Uruchomienie modeli AI (Wymuszamy inty dla okien, żeby Pandas nie marudził w trybie stream)
        def _run_pipeline(input_df, use_hall):
            d = input_df.copy()
            # Pobranie docelowego Aliasu dla maszyny
            alias = hwstate.sensor_aliases.get(str(sn), str(sn))
            
            import bearing_monitor
            is_heavy = any(keyword.upper() in alias.upper() for keyword in bearing_monitor.HEAVY_KEYWORDS)
            is_oil = any(keyword.upper() in alias.upper() for keyword in bearing_monitor.OIL_KEYWORDS)
            
            try:
                if 'vib_max' not in d or d['vib_max'].isna().all():
                    d['crest_factor'] = 1.5 
                    d['vib_max'] = d.get('vib_rms', 0.0) * d['crest_factor'] 
                
                WIN_30D = 30 * 24 * 12 # 30 dni w interwałach 5-min
                WIN_1H = 12            # 1 godzina w interwałach 5-min
                
                try: d = analyze_skf_crest_factor(d, is_heavy)
                except Exception as e: pass
                
                try: 
                    import bearing_monitor
                    bearing_monitor.SIEMENS_BASELINE_WINDOW = WIN_30D
                    d = analyze_siemens_baseline(d)
                except Exception as e: pass
                
                try: 
                    bearing_monitor.AWS_GRADIENT_WINDOW = WIN_1H
                    hall_temp_series = None
                    if use_hall and '30001856' in hwstate.sensor_history and not hwstate.sensor_history['30001856'].empty:
                        # [POPRAWKA] Przygotuj dane hali do formatu agregowanego (DatetimeIndex)
                        df_hall_raw = hwstate.sensor_history['30001856'].copy()
                        df_hall_raw['timestamp'] = pd.to_datetime(df_hall_raw['timestamp'], unit='ms').dt.tz_localize('UTC').dt.tz_convert('Europe/Warsaw').dt.tz_localize(None)
                        df_hall_prep = bearing_monitor.prepare_hall_data(df_hall_raw)
                        if not df_hall_prep.empty:
                            hall_temp_series = df_hall_prep['hall_temp']
                    d = analyze_aws_gradient(d, hall_temp=hall_temp_series, is_heavy=is_heavy, is_oil=is_oil) 
                except Exception as e: 
                    # print(f"DEBUG: Hall error for {sn}: {e}")
                    pass
                
                if delta_df is not None:
                    try: d = analyze_rcf_anomaly(d) 
                    except Exception as e: pass
                else:
                    if 'rcf_score' not in d.columns: d['rcf_score'] = 0.0
                
                d = fuse_alarms(d, is_heavy)
                d = calculate_health_index(d)
                return d
            except Exception as e:
                print(f"[!] Błąd Pipeline w trybie {'Kompensacja' if use_hall else 'Raw'}: {e}")
                return d

        df_raw = _run_pipeline(df, False)
        df_comp = _run_pipeline(df, True)
        
        # Wybierz aktywny DF do UI (ustawi status maszyn, HI i Prob)
        active_df = df_comp if hwstate.settings.get("use_hall_compensation", True) else df_raw
        
        # [POPRAWKA] Jeśli to jest sensor hali (30001856), omijamy dalszą analizę alarmów łożyskowych,
        # ale musimy go zapisać do historii, żeby inne sensory mogły go używać jako referencji.
        if sn == '30001856':
            try:
                latest_status = df.iloc[-1]
                hwstate.live_snapshot[sn] = {
                    "sn": sn,
                    "alias": hwstate.sensor_aliases.get(sn, sn),
                    "timestamp": int(latest_status.name.timestamp()*1000) if hasattr(latest_status.name, 'timestamp') else int(time.time()*1000),
                    "temp": float(latest_status.get('temp_mean', 0.0)),
                    "vib_rms": 0.0,
                    "health_index": 100.0,
                    "failure_prob": 0.0,
                    "status": "AKTIV (HALLE)"
                }
                return # Wyjście dla sensora hali po zapisaniu snapshotu
            except Exception as e:
                print(f"[!] Błąd zapisu snapshotu dla sensora hali: {e}")
                return
        
        try:
            latest_status = active_df.iloc[-1]
            status_val = str(latest_status.get('FINAL_VERDICT', 'OK'))
            
            raw_hi = latest_status.get('health_index', 100.0)
            hi_val = round(float(raw_hi), 1) if pd.notnull(raw_hi) else 100.0
            
            raw_prob = latest_status.get('failure_probability', 0.0)
            prob_val = round(float(raw_prob), 1) if pd.notnull(raw_prob) else 0.0
        except Exception as ai_err:
            print(f"[!] AI Pipeline crash for {sn}: {ai_err}")
            latest_status = df.iloc[-1]
            status_val = "UNKNOWN"
            hi_val = 100.0
            prob_val = 0.0
        
        # Tworzymy pakunek dla Dashboardu UI
        hwstate.live_snapshot[sn] = {
            "sn": sn,
            "alias": hwstate.sensor_aliases.get(sn, sn),
            "timestamp": int(latest_status.name.timestamp()*1000) if hasattr(latest_status.name, 'timestamp') else int(time.time()*1000),
            "temp": float(latest_status.get('temp_mean', 0.0)),
            "vib_rms": float(latest_status.get('vib_rms', 0.0)),
            "health_index": float(hi_val),
            "failure_prob": float(prob_val),
            "status": status_val
        }
        
        # AKTUALIZACJA LOGU ZDARZEŃ (Analiza historyczna przy Warm-upie)
        def _append_anomalies(target_df, history_list):
            tdf = target_df if len(target_df) > 20 else target_df.tail(1)
            anomalies = tdf[~tdf['FINAL_VERDICT'].isin(['IDLE', '🟢 MONITORING', 'UNKNOWN', 'INAKTIV'])]
            
            if not anomalies.empty:
                anomalies = anomalies.copy()
                if not isinstance(anomalies.index, pd.DatetimeIndex):
                    anomalies.index = pd.to_datetime(anomalies.index)
                anomalies['day'] = anomalies.index.date
                daily_top = anomalies.sort_values(['day', 'max_priority'], ascending=[True, False]).drop_duplicates('day')
                
                # Norwegian UI Translations for Live Streaming Events
                translation_map = {
                    '🟡 PLANLEGG SERVICE': '🟡 PLANLEGG SERVICE',
                    '🔴 KRITISK ALARM': '🔴 KRITISK ALARM',
                    '🔴🔥 BRANN/STOPP': '🔴🔥 BRANN/STOPP — STOPP LINJEN!'
                }
                
                for timestamp, row in daily_top.iterrows():
                    now_dt = timestamp if hasattr(timestamp, 'timestamp') else datetime.now()
                    ts_iso = now_dt.isoformat()
                    
                    if not any(e['sn'] == sn and e['timestamp'][:10] == ts_iso[:10] for e in history_list):
                        final_verdict_no = translation_map.get(row['FINAL_VERDICT'], row['FINAL_VERDICT'])
                        history_list.append({
                            "sn": sn,
                            "alias": hwstate.sensor_aliases.get(sn, sn),
                            "timestamp": ts_iso,
                            "type": final_verdict_no,
                            "msg": f"AI-hendelse detektert ({row['alarm_source']})",
                            "vib_rms": float(row.get('vib_rms', 0.0)),
                            "temp_mean": float(row.get('temp_mean', 0.0)),
                            "temp_gradient": float(row.get('temp_gradient_final', 0.0))
                        })

        _append_anomalies(df_raw, hwstate.event_history_raw)
        _append_anomalies(df_comp, hwstate.event_history_comp)
        
        # Limit i sortowanie w obu listach
        hwstate.event_history_raw.sort(key=lambda x: x['timestamp'], reverse=True)
        hwstate.event_history_raw = hwstate.event_history_raw[:500]
        
        hwstate.event_history_comp.sort(key=lambda x: x['timestamp'], reverse=True)
        hwstate.event_history_comp = hwstate.event_history_comp[:500]
        
        save_event_history(hwstate)

    except Exception as e:
        print(f"[!] Błąd AI Engine dla {sn}: {e}")


async def push_snapshot_to_ui(hwstate: HardwareState):
    """
    Funkcja zapisująca JSON uzywając mechanizmu Atomicznego 
    (Publiser Pattern). Chroni Front przed Race-Conditions
    """
    tmp_path = OUTPUT_JSON_PATH + ".tmp"
    
    active_history = hwstate.event_history_comp if hwstate.settings.get("use_hall_compensation", True) else hwstate.event_history_raw
    
    snapshot = {
        "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "mining_progress": hwstate.mining_progress,
        "sensors": list(hwstate.live_snapshot.values()),
        "events": sorted(active_history, key=lambda x: x['timestamp'], reverse=True)[:2000] # Top 2000 do UI (2 miesiące)
    }
    
    with open(tmp_path, 'w', encoding='utf-8') as f:
        # Standardowy JSON nie akceptuje NaN. Konwertujemy na null.
        json_str = json.dumps(snapshot, ensure_ascii=True, indent=2, allow_nan=True)
        # Szybka zamiana unquoted NaN na null (bezpieczne dla standardu)
        json_str = json_str.replace(': NaN', ': null').replace(': Infinity', ': null').replace(': -Infinity', ': null')
        f.write(json_str)
        
    # Atomowa podmiana - Windows/Linux - zero lockow w Przegladarce! (Atomic rename)
    os.replace(tmp_path, OUTPUT_JSON_PATH)
    print(f"[OK] Wydano nowy snapshot danych Live do {OUTPUT_JSON_PATH}")


async def run_polling_cycle(session: aiohttp.ClientSession, hwstate: HardwareState):
    """Pojedyńczy puls maszyny stanu"""
    start_time = time.time()
    
    # 1. Asynchroniczne pobranie danych z serwerow za pomocna limitera zadan.
    # Używamy semaforu by nie zadusić API uzytkownika robiąc nagle 150 strzalow w milisekunde.
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)
    
    async def fetch_with_sema(sn):
        async with semaphore:
            return await fetch_sensor_delta(session, hwstate, sn)
            
    tasks = [fetch_with_sema(sn) for sn in hwstate.active_sensors]
    results = await asyncio.gather(*tasks) # Czekamy aż WSZYSTKO wróci na raz 
    
    # 2. Rownolegla iteracja i Inference
    total_fetched = 0
    with_data = 0
    for sn, delta_df in results:
        if not delta_df.empty:
            total_fetched += len(delta_df)
            with_data += 1
            run_ai_inference(hwstate, sn, delta_df)
            
    print(f"[*] Przetworzono dane: {with_data}/{len(hwstate.active_sensors)} czujników zwróciło łącznie {total_fetched} próbek.")
        
    # 3. Zrzucenie stanu 
    await push_snapshot_to_ui(hwstate)
    
    elapsed = time.time() - start_time
    print(f"--- Cykl przetworzony w {elapsed:.2f}s ---")


def load_event_history(hwstate):
    """Wczytuje log zdarzeń z pliku"""
    if os.path.exists(EVENT_LOG_PATH):
        try:
            with open(EVENT_LOG_PATH, 'r', encoding='utf-8') as f:
                hwstate.event_history = json.load(f)
        except:
            hwstate.event_history = []

def save_event_history(hwstate):
    """Zapisuje chronologiczne logi zdarzeń do osobnych plików"""
    def _save(history_list, path):
        try:
            history_list.sort(key=lambda x: x['timestamp'], reverse=True)
            seen = set()
            unique_events = []
            for e in history_list:
                key = (e['sn'], e['timestamp'][:13]) 
                if key not in seen:
                    unique_events.append(e)
                    seen.add(key)
            with open(path, 'w', encoding='utf-8') as f:
                json.dump(unique_events[:2000], f, indent=2, ensure_ascii=False)
        except:
            pass
            
    _save(hwstate.event_history_raw, EVENT_LOG_PATH_RAW)
    _save(hwstate.event_history_comp, EVENT_LOG_PATH_COMP)

async def mine_historical_events(hwstate):
    """
    Przeszukuje sensor_history w poszukiwaniu historycznych alarmów (Dual Mining).
    """
    print("[*] Rozpoczynam poszukiwanie historycznych alarmów (60 dni)...")
    import bearing_monitor as ai
    
    found_raw = 0
    found_comp = 0
    
    sorted_sns = sorted(hwstate.sensor_history.keys())
    if "21008169" in sorted_sns:
        sorted_sns.remove("21008169")
        sorted_sns = ["21008169"] + sorted_sns
    total_sns = len(sorted_sns)
    hwstate.mining_progress = 0.0
    
    for i, sn in enumerate(sorted_sns):
        hwstate.mining_progress = round((i / total_sns) * 100, 1) if total_sns > 0 else 100.0
        if i % 10 == 0: await push_snapshot_to_ui(hwstate)
        
        df = hwstate.sensor_history[sn]
        if len(df) < 50: continue
        
        try:
            df_ai = df.copy()
            # [POPRAWKA] Konwersja timestamp na DatetimeIndex dla resample
            df_ai['timestamp'] = pd.to_datetime(df_ai['timestamp'], unit='ms').dt.tz_localize('UTC').dt.tz_convert('Europe/Warsaw').dt.tz_localize(None)
            
            # Unit mapping fix
            unit_map = {'C': '°C', 'c': '°C', 'G': 'g', 'g': 'g'}
            df_ai['unit'] = df_ai['unit'].apply(lambda x: unit_map.get(x, x))
            
            prep_df = ai.prepare_bearing_data(df_ai)
            if prep_df.empty: continue
            
            
            def _mine_pipeline(input_df, use_hall):
                # Detekcja rębaka
                alias = hwstate.sensor_aliases.get(str(sn), str(sn))
                is_heavy_impact = any(keyword.upper() in alias.upper() for keyword in ai.HEAVY_KEYWORDS)
                is_oil = any(keyword.upper() in alias.upper() for keyword in ai.OIL_KEYWORDS)
                
                d = input_df.copy()
                if 'vib_max' not in d or d['vib_max'].isna().all():
                    d['crest_factor'] = 1.5 
                    d['vib_max'] = d.get('vib_rms', 0.0) * d['crest_factor'] 
                
                WIN_30D = 30 * 24 * 12 
                WIN_1H = 12            
                
                try: d = ai.analyze_skf_crest_factor(d, is_heavy_impact)
                except Exception: pass
                
                try: 
                    ai.SIEMENS_BASELINE_WINDOW = WIN_30D
                    d = ai.analyze_siemens_baseline(d)
                except Exception: pass
                
                try:
                    ai.AWS_GRADIENT_WINDOW = WIN_1H
                    hall_temp = None
                    if use_hall and '30001856' in hwstate.sensor_history:
                        hraw = hwstate.sensor_history['30001856'].copy()
                        # [POPRAWKA] Konwersja timestamp dla hali
                        hraw['timestamp'] = pd.to_datetime(hraw['timestamp'], unit='ms').dt.tz_localize('UTC').dt.tz_convert('Europe/Warsaw').dt.tz_localize(None)
                        hpre = ai.prepare_hall_data(hraw)
                        hall_temp = hpre['hall_temp'] if not hpre.empty else None
                    d = ai.analyze_aws_gradient(d, hall_temp=hall_temp, is_heavy=is_heavy_impact, is_oil=is_oil)
                except Exception: pass
                
                try: d = ai.analyze_rcf_anomaly(d)
                except Exception: pass
                
                d = ai.fuse_alarms(d, is_heavy_impact)
                return d
            
            df_raw = _mine_pipeline(prep_df, False)
            df_comp = _mine_pipeline(prep_df, True)
            
            
            def _append_anomalies(res_df, history_list):
                anoms = res_df[~res_df['FINAL_VERDICT'].isin(['IDLE', '🟢 MONITORING', 'UNKNOWN'])]
                count = 0
                if not anoms.empty:
                    anoms = anoms.copy()
                    if not isinstance(anoms.index, pd.DatetimeIndex): anoms.index = pd.to_datetime(anoms.index)
                    anoms['day'] = anoms.index.date
                    top = anoms.sort_values(['day', 'max_priority'], ascending=[True, False]).drop_duplicates('day')
                    translation_map = {
                        '🟡 PLANLEGG SERVICE': '🟡 PLANLEGG SERVICE',
                        '🔴 KRITISK ALARM': '🔴 KRITISK ALARM',
                        '🔴🔥 BRANN/STOPP': '🔴🔥 BRANN/STOPP — STOPP LINJEN!'
                    }
                    for ts, row in top.iterrows():
                        ts_iso = ts.isoformat()
                        # Unikaj duplikatów dziennych dla tego samego sensora
                        if not any(e['sn'] == sn and e['timestamp'][:10] == ts_iso[:10] for e in history_list):
                            history_list.append({
                                "sn": sn,
                                "alias": hwstate.sensor_aliases.get(sn, sn),
                                "timestamp": ts_iso,
                                "type": translation_map.get(row['FINAL_VERDICT'], row['FINAL_VERDICT']),
                                "msg": f"AI-hendelse detektert ({row['alarm_source']})",
                                "vib_rms": float(row.get('vib_rms', 0.0)),
                                "temp_mean": float(row.get('temp_mean', 0.0)),
                                "temp_gradient": float(row.get('temp_gradient_final', 0.0))
                            })
                            count += 1
                return count

            found_raw += _append_anomalies(df_raw, hwstate.event_history_raw)
            found_comp += _append_anomalies(df_comp, hwstate.event_history_comp)
            
            # Aktualizacja postępu i incremental save
            hwstate.mining_progress = round((i + 1) / total_sns * 100, 1)
            await push_snapshot_to_ui(hwstate)
            
            if found_comp > 0:
                save_event_history(hwstate)

        except Exception as e:
            print(f"     [!] Błąd mining dla {sn}: {e}")
            continue
             
    hwstate.mining_progress = 100.0
    
    # Sortowanie i limitowanie historii
    hwstate.event_history_raw.sort(key=lambda x: x['timestamp'], reverse=True)
    hwstate.event_history_raw = hwstate.event_history_raw[:2000]
    
    hwstate.event_history_comp.sort(key=lambda x: x['timestamp'], reverse=True)
    hwstate.event_history_comp = hwstate.event_history_comp[:2000]
    
    await push_snapshot_to_ui(hwstate)
    
    if found_raw > 0 or found_comp > 0:
        print(f"     ✅ Znaleziono: {found_raw} (RAW) | {found_comp} (COMP) historycznych alarmów.")
        save_event_history(hwstate)
    else:
        print("[*] Ingen nye alarmer funnet i historien.")

def load_settings(hwstate: HardwareState):
    """Odczytuje ustawienia z pliku daemon_settings.json"""
    path = "daemon_settings.json"
    if os.path.exists(path):
        try:
            with open(path, "r", encoding="utf-8") as f:
                new_settings = json.load(f)
                
                # Sprawdź czy zmieniono flagę kompensacji halowej
                old_val = hwstate.settings.get("use_hall_compensation", True)
                new_val = new_settings.get("use_hall_compensation", True)
                
                hwstate.settings = new_settings
                
                if old_val != new_val:
                    print(f"[*] Kompensacja halowa zmieniona na: {new_val}. Obie bazy są już w RAM.")
                    return True 
        except Exception as e:
            print(f"[!] Błąd odczytu ustawień: {e}")
    return False

async def get_active_sensors(session, hwstate):
    """Pobiera listę urządzeń i filtruje TYLKO te z tagiem TAG_FILTER"""
    url = f"{API_BASE_URL}/systems/{SYSTEM_ID}/devices"
    headers = { "ApiKey": API_KEY }
    
    try:
        async with session.get(url, headers=headers) as resp:
            if resp.status != 200:
                print(f"[CRITICAL] Błąd API Devices: {resp.status}")
                return []
            
            data = await resp.json()
            devices = data if isinstance(data, list) else data.get('devices', [])
            
            # Filtrowanie po TAGU
            filtered = []
            for d in devices:
                info = d.get('info', {})
                tags = d.get('tags', []) or info.get('tags', [])
                alias = str(d.get('alias', '') or info.get('alias', '')).lower()
                
                # Szukamy czy KTÓRYKOLWIEK tag zawiera frazę TAG_FILTER
                found = TAG_FILTER.lower() in alias
                if not found:
                    for t in tags:
                        tag_name = str(t if isinstance(t, str) else t.get('name', '')).lower()
                        if TAG_FILTER.lower() in tag_name:
                            found = True
                            break
                
                if found:
                    sn_str = str(d.get('serialNumber') or d.get('sn'))
                    filtered.append(sn_str)
                    
                    # Agresywne szukanie najlepszej nazwy
                    best_name = d.get('alias') or info.get('alias') or d.get('name') or info.get('name') or d.get('description') or info.get('description') or sn_str
                    hwstate.sensor_aliases[sn_str] = best_name
            
            # Pre-populuj snapshot, żeby Dashboard od razu miał Aliasy (nawet dla nieaktywnych)
            for sn_match in filtered:
                alias = hwstate.sensor_aliases.get(sn_match, sn_match)
                if sn_match not in hwstate.live_snapshot:
                    hwstate.live_snapshot[sn_match] = {
                        "sn": sn_match,
                        "alias": alias,
                        "timestamp": int(time.time()*1000),
                        "temp": 0.0,
                        "vib_rms": 0.0,
                        "health_index": 100.0,
                        "failure_prob": 0.0,
                        "status": "INAKTIV"
                    }
            
            return [f for f in filtered if f]
    except Exception as e:
        print(f"[CRITICAL] Błąd pobierania urządzeń: {e}")
        return []

def load_persistence(hwstate):
    """Wczytuje 60 dni historii z dysku (Parquet)"""
    path = PERSISTENCE_FILE
    if not os.path.exists(path):
        print("[!] Ingen historikkfil. Starter som ny.")
        return

    try:
        print(f"[*] Wczytuję historię z {PERSISTENCE_FILE}...")
        df_all = pd.read_parquet(PERSISTENCE_FILE)
        
        # Rozdzielamy na poszczególne sensory
        for sn, df_sn in df_all.groupby('sn'):
            # Zapewniamy formę kolumny, by zachować spójność ze strumieniem live
            if 'timestamp' in df_sn.columns:
                df_sn['timestamp'] = df_sn['timestamp'].astype(int)
            
            # Wyrzucamy kolumnę ze starym sn jeśli istnieje z parqueta
            if 'sn' in df_sn.columns:
                df_sn = df_sn.drop(columns=['sn'])

            hwstate.sensor_history[str(sn)] = df_sn
            if not df_sn.empty:
                hwstate.last_timestamps[str(sn)] = int(df_sn['timestamp'].max())
        
        print(f"[OK] Załadowano historię dla {len(hwstate.sensor_history)} sensorów.")
    except Exception as e:
        print(f"[!] Błąd ładowania historii: {e}")

def save_persistence(hwstate):
    """Zrzuca całą historię z RAM do Parquet (60 dni)"""
    try:
        frames = []
        now = pd.Timestamp.now()
        cutoff_time_ms = int((now - timedelta(days=RETENTION_DAYS)).timestamp() * 1000)
        
        # Przycinanie RAM
        for sn in list(hwstate.sensor_history.keys()):
            df = hwstate.sensor_history[sn]
            if not df.empty and 'timestamp' in df.columns:
                hwstate.sensor_history[sn] = df[df['timestamp'] >= cutoff_time_ms].copy()

        for sn, df in hwstate.sensor_history.items():
            if df.empty or 'timestamp' not in df.columns: continue
            # Przycinamy historię do RETENTION_DAYS przed zapisem
            df_filtered = df[df['timestamp'] >= cutoff_time_ms].copy()
            df_filtered['sn'] = sn
            frames.append(df_filtered)
        
        if frames:
            df_final = pd.concat(frames)
            df_final.to_parquet(PERSISTENCE_FILE, index=False, compression='snappy')
            # print(f"[OK] Zapisano stan do {PERSISTENCE_FILE} ({len(df_final)} rekordów)")
    except Exception as e:
        print(f"[!] Błąd zapisu historii: {e}")

async def main():
    print("===================================================")
    print("   UR Live Daemon - Real-time AI Analysis Stream   ")
    print("   Mode: Asynchronous Polling & In-Memory AI       ")
    print("===================================================")
    
    hwstate = HardwareState()
    
    # 1. Wczytaj historię z dysku
    load_persistence(hwstate)
    
    # Próbujemy wczytać log zdarzeń jeśli istnieje (opcjonalnie, zwykle mining załatwi sprawę)
    try:
        if os.path.exists(EVENT_LOG_PATH_RAW):
            with open(EVENT_LOG_PATH_RAW, 'r', encoding='utf-8') as f:
                hwstate.event_history_raw = json.load(f)
        if os.path.exists(EVENT_LOG_PATH_COMP):
            with open(EVENT_LOG_PATH_COMP, 'r', encoding='utf-8') as f:
                hwstate.event_history_comp = json.load(f)
    except:
        pass
    
    async with aiohttp.ClientSession() as session:
        # 2. Pobierz aktualną listę sensorów (z filtrem tagu)
        hwstate.active_sensors = await get_active_sensors(session, hwstate)
        
        if not hwstate.active_sensors:
            print("[ERROR] Ingen sensorer å overvåke etter filtrering. Sjekk tag 'saglinje'.")
            return

        # [PRIORYTET] JEDNORAZOWY MINING: Zaraz po starcie, zanim wejdziemy w pętle. 
        # To pozwala nam odzyskać historię zdarzeń z Parquet w kilka sekund.
        if not hasattr(hwstate, 'mined_once'):
            await mine_historical_events(hwstate)
            hwstate.mined_once = True

        # 3. WYMUŚ NATYCHMIASTOWY SNAPSHOT UI
        print("[*] Inicjalizacja snapshotów z historii...")
        for sn in hwstate.active_sensors:
            if sn in hwstate.sensor_history and not hwstate.sensor_history[sn].empty:
                # [POPRAWKA] Usuwamy ewentualne śmieci z timestampem 0 (z poprzedniej nieudanej inicjalizacji)
                h = hwstate.sensor_history[sn]
                hwstate.sensor_history[sn] = h[h['timestamp'] > 0]
                
                # Wywołaj inference bez dodawania danych, żeby zapełnić UI snapshotami z RAM
                run_ai_inference(hwstate, sn, None)
        
        await push_snapshot_to_ui(hwstate)

        print(f"[*] Startuję pętlę monitoringu dla {len(hwstate.active_sensors)} maszyn...")
        
        # JEDNORAZOWY MINING: Zaraz po starcie (z RAMu Parquet)
        if not hasattr(hwstate, 'mined_once'):
            await mine_historical_events(hwstate)
            hwstate.mined_once = True

        cycle_count = 0
        while True:
            # Sprawdź zmiany w ustawieniach
            if load_settings(hwstate):
                # Usunięto re-mining (Teraz mamy pre-kalkulowane bazy). Wystarczy odświeżyć UI.
                print("[*] Zmiana w UI. Natychmiastowe odświeżenie danych z alternate db...")
                await push_snapshot_to_ui(hwstate)

            start_time = time.time()
            print(f"\n--- Cykl Polling #{cycle_count} (Sensorów: {len(hwstate.active_sensors)}) ---")
            
            try:
                await run_polling_cycle(session, hwstate)
            except Exception as e:
                print(f"[CRITICAL] Błąd w cyklu monitoringu: {e}")
            
            # Zapisuj stan na dysk częściej przy starcie (dla testów i pewności danych)
            cycle_count += 1
            if cycle_count <= 10 or cycle_count % 5 == 0:
                save_persistence(hwstate)
            
            elapsed = time.time() - start_time
            sleep_total = max(0, POLL_INTERVAL_SECONDS - elapsed)
            
            # [POPRAWKA] Zamiast spać ciurkiem 120s, śpimy w małych interwałach
            # sprawdzając czy użytkownik nie zmienił ustawień w Dashboardzie.
            for _ in range(int(sleep_total)):
                if load_settings(hwstate):
                    print("[*] Zmiana w UI (w trakcie oczekiwania). Natychmiastowe odświeżenie...")
                    await push_snapshot_to_ui(hwstate)
                await asyncio.sleep(1)
            
            # Pozostała ułamkowa część sekundy
            await asyncio.sleep(sleep_total % 1)

if __name__ == "__main__":
    # Windows fix dla petli asyncio
    if os.name == 'nt':
         asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
         
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nZatrzymano Daemon UR Live ręcznie.")
