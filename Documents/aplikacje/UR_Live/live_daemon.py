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

POLL_INTERVAL_SECONDS = 120 # Odświeżanie z API (zgodnie z sugestią użytkownika - 2 minuty)
WARM_HISTORY_DAYS = 120      # Ile dni wstecz pobrać przy pierwszym rozruchu (lub uzupełnić luki)
MAX_CONCURRENT_REQUESTS = 50       # Zwiększono przepustowość dla 111 sensorów
OUTPUT_JSON_PATH = "live_status.json" # Plik wyjściowy (Atomic write)
EVENT_LOG_PATH = "event_history.json" # Nowy plik z historią zdarzeń
PERSISTENCE_FILE = "sensor_history.parquet" # Baza danych 90 dni 
TAG_FILTER = "saglinje" # TYLKO te maszyny
RETENTION_DAYS = 90         # Ile dni historii trzymać w pamięci i na dysku

# PRAWDZIWE DANE Z KODU FRONTENDU
API_KEY = "jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI="
SYSTEM_ID = "nIwosVxCrK9RTctvb90X"
API_BASE_URL = "https://api.neuronsensors.app/v2"


class HardwareState:
    def __init__(self):
        self.active_sensors = []
        self.sensor_history = {}    # { sn: DataFrame } - trzymamy 90 dni w RAM
        self.last_timestamps = {}   # { sn: last_ms }
        self.sensor_aliases = {}    # { sn: alias }
        self.live_snapshot = {}     # { sn: latest_result_dict }
        self.event_history = []     # Lista słowników: {sn, alias, timestamp, type, msg}
        self.settings = {"use_hall_compensation": True}


async def fetch_sensor_delta(session: aiohttp.ClientSession, hwstate: HardwareState, sn: str):
    """
    Pobiera tylko DELTĘ danych od ostatniego odpytania (Micro-batch)
    """
    now_ts = int(time.time() * 1000)
    # Domyślnie bierzemy historię z WARM_HISTORY_DAYS, jeśli nie mamy nic w pamięci
    last_ts = hwstate.last_timestamps.get(sn, now_ts - WARM_HISTORY_DAYS * 24 * 60 * 60 * 1000) 
    
    url = f"{API_BASE_URL}/systems/{SYSTEM_ID}/devices/{sn}/samples?from={last_ts}&to={now_ts}&limit=1000"
    headers = { "ApiKey": API_KEY }
    
    try:
        async with session.get(url, headers=headers, timeout=30) as response:
            if response.status != 200:
                print(f"[!] Błąd HTTP {response.status} dla SN {sn}")
                return sn, pd.DataFrame()
                
            data = await response.json()
            
            # Przekładanie formatu wzięte z route.ts
            extracted = []
            if isinstance(data, list): extracted = data
            elif data and isinstance(data.get('items'), list): extracted = data['items']
            elif data and isinstance(data, dict):
                for v in data.values():
                    if isinstance(v, list):
                        extracted = v
                        break
                        
            if not extracted:
                hwstate.last_timestamps[sn] = now_ts
                return sn, pd.DataFrame()
                
            # Budujemy Dataframe
            records = []
            for s in extracted:
                ts = s.get('timestamp') or s.get('time')
                if not ts: continue
                # Konwertuj timestamp ISO stringa na ms
                # Konwertuj timestamp/time na ms
                try:
                    if isinstance(ts, (int, float)):
                        # Pozwól Pandas obsłużyć liczby z jawnym unit='ms' 
                        # lub po prostu przypisz jeśli wiemy że to ms
                        unix_ms = int(ts)
                    else:
                        # Dla stringów ISO
                        unix_ms = int(pd.to_datetime(ts).timestamp() * 1000)
                except:
                    unix_ms = 0
                    
                records.append({
                    'sn': sn,
                    'time': str(ts),
                    'unit': s.get('unit', 'g'),
                    'value': s.get('value', 0.0),
                    'timestamp': unix_ms
                })
                
            df_delta = pd.DataFrame(records)
            if not df_delta.empty:
                df_delta.sort_values('timestamp', inplace=True)
                
            hwstate.last_timestamps[sn] = now_ts
            return sn, df_delta
            
    except Exception as e:
        # print(f"[!] Błąd asynchronicznego pobierania SN {sn}: {type(e).__name__} - {e}")
        return sn, pd.DataFrame()


def run_ai_inference(hwstate: HardwareState, sn: str, delta_df: pd.DataFrame):
    """
    Kalkulacja w czasie rzezywistym (Warstwa Processing w Pamięci) 
    """
    if delta_df.empty:
        return
        
    # 1. Dolaczamy Delte do historii
    if sn not in hwstate.sensor_history or hwstate.sensor_history[sn].empty:
        # Initial Boot
        hwstate.sensor_history[sn] = delta_df
    else:
        # Appending micro-batch
        hwstate.sensor_history[sn] = pd.concat([hwstate.sensor_history[sn], delta_df], ignore_index=True)
        # Opcjonalne Trimowanie do ostatnich "WARM_HISTORY_DAYS" 
        # By uniknac Out-Of-Memory na serwerze 
        
    df_context = hwstate.sensor_history[sn]
        
    # Bezpiecznik: Potrzebujemy chociaż 1 punktu by cokolwiek wyświetlić w Dashboardzie Live
    if len(df_context) < 1:
        return
        
    try:
        # 1. Przygotowanie danych (Konwersja na Datetime i Agregacja 5-min wg standardu b.monitor)
        df_raw = df_context.copy()
        # Upewniamy się, że timestamp to Datetime dla resamplingu
        df_raw['timestamp'] = pd.to_datetime(df_raw['timestamp'], unit='ms')
        
        # 2. Uruchomienie standardowego rurociągu przygotowawczego (Resample, Agg, Production Classify)
        # To załatwi nam 'vib_max', 'vib_rms', 'temp_mean' i poprawny DatetimeIndex
        df = prepare_bearing_data(df_raw)
        
        if df.empty:
            return

        # 3. Uruchomienie modeli AI (Wymuszamy inty dla okien, żeby Pandas nie marudził w trybie stream)
        try:
            df['crest_factor'] = 1.5 
            df['vib_max'] = df.get('vib_rms', 0.0) * df['crest_factor'] 
            
            # Parametry okien jako liczby całkowite (bezpieczniejsze w streamingu)
            WIN_30D = 30 * 24 * 12 # 30 dni w interwałach 5-min
            WIN_1H = 12            # 1 godzina w interwałach 5-min
            
            try: df = analyze_skf_crest_factor(df)
            except Exception as e: print(f"  [SKF ERR] {sn}: {e}")
            
            try: 
                # Patchujemy okno w locie przed wywołaniem
                import bearing_monitor
                bearing_monitor.SIEMENS_BASELINE_WINDOW = WIN_30D
                df = analyze_siemens_baseline(df)
            except Exception as e: print(f"  [SIEMENS ERR] {sn}: {e}")
            
            try: 
                bearing_monitor.AWS_GRADIENT_WINDOW = WIN_1H
                
                # Przekazanie temperatury z hali (Sensor 30001856) do kompensacji gradientu
                hall_temp_series = None
                if hwstate.settings.get("use_hall_compensation", True):
                    if '30001856' in hwstate.sensor_history and not hwstate.sensor_history['30001856'].empty:
                        hall_temp_series = hwstate.sensor_history['30001856']['temp_mean']
                    
                df = analyze_aws_gradient(df, hall_temp=hall_temp_series) 
            except Exception as e: print(f"  [AWS ERR] {sn}: {e}")
            
            try: df = analyze_rcf_anomaly(df) 
            except Exception as e: print(f"  [RCF ERR] {sn}: {e}")
            
            df = fuse_alarms(df)
            df = calculate_health_index(df)
            
            latest_status = df.iloc[-1]
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
        
        # Tworzymy pakunek dla Dashboardu UI (Zawsze, nawet przy błędzie AI)
        hwstate.live_snapshot[sn] = {
            "sn": sn,
            "alias": hwstate.sensor_aliases.get(sn, sn),
            "timestamp": int(latest_status.name.timestamp()*1000) if hasattr(latest_status.name, 'timestamp') else int(time.time()*1000),
            "temp": float(latest_status.get('temp_mean', 0.0)),
            "vib_rms": float(latest_status.get('vib_rms', 0.0)),
            "health_index": float(latest_status.get('health_index', 100.0)),
            "failure_prob": float(latest_status.get('failure_prob', 0.0)),
            "status": status_val
        }
        
        # AKTUALIZACJA LOGU ZDARZEŃ (Analiza historyczna przy Warm-upie)
        # Jeżeli mamy dużo danych (np. po pobraniu 90 dni), przeszukaj wszystko
        target_df = df if len(df) > 20 else df.tail(1)
        
        anomalies = target_df[~target_df['FINAL_VERDICT'].isin(['IDLE', '🟢 MONITORING', 'UNKNOWN', 'INAKTIV'])]
        if not anomalies.empty:
            # Grupuj po dniach, aby nie zaspamować logu tysiącem wpisów z jednej awarii
            anomalies = anomalies.copy()
            anomalies['day'] = anomalies.index.date
            daily_top = anomalies.sort_values(['day', 'max_priority'], ascending=[True, False]).drop_duplicates('day')
            
            for timestamp, row in daily_top.iterrows():
                now_dt = timestamp if hasattr(timestamp, 'timestamp') else datetime.now()
                ts_iso = now_dt.isoformat()
                
                # Unikalność: nie dodawaj jeśli już jest taki sam SN + dzień
                if not any(e['sn'] == sn and e['timestamp'][:10] == ts_iso[:10] for e in hwstate.event_history):
                    hwstate.event_history.append({
                        "sn": sn,
                        "alias": hwstate.sensor_aliases.get(sn, sn),
                        "timestamp": ts_iso,
                        "type": row['FINAL_VERDICT'],
                        "msg": f"AI-hendelse detektert ({row['alarm_source']})",
                        "vib_rms": float(row.get('vib_rms', 0.0)),
                        "temp_mean": float(row.get('temp_mean', 0.0)),
                        "temp_gradient": float(row.get('temp_gradient_final', 0.0))
                    })
            
            # Limit 500 zdarzeń
            hwstate.event_history.sort(key=lambda x: x['timestamp'], reverse=True)
            hwstate.event_history = hwstate.event_history[:500]
            save_event_history(hwstate)

    except Exception as e:
        print(f"[!] Błąd AI Engine dla {sn}: {e}")


async def push_snapshot_to_ui(hwstate: HardwareState):
    """
    Funkcja zapisująca JSON uzywając mechanizmu Atomicznego 
    (Publiser Pattern). Chroni Front przed Race-Conditions
    """
    tmp_path = OUTPUT_JSON_PATH + ".tmp"
    
    snapshot = {
        "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "sensors": list(hwstate.live_snapshot.values()),
        "events": sorted(hwstate.event_history, key=lambda x: x['timestamp'], reverse=True)[:50] # Top 50 do UI
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
    """Zapisuje log zdarzeń do pliku"""
    try:
        # Sortuj chronologicznie przed zapisem
        hwstate.event_history.sort(key=lambda x: x['timestamp'], reverse=True)
        # Unikalność po SN i Timestamp (zaokrąglonym do godziny)
        seen = set()
        unique_events = []
        for e in hwstate.event_history:
            key = (e['sn'], e['timestamp'][:13]) 
            if key not in seen:
                unique_events.append(e)
                seen.add(key)
        
        with open(EVENT_LOG_PATH, 'w', encoding='utf-8') as f:
            json.dump(unique_events[:500], f, indent=2, ensure_ascii=False)
    except:
        pass

async def mine_historical_events(hwstate):
    """
    Przeszukuje sensor_history w poszukiwaniu historycznych alarmów.
    Wywoływane raz przy starcie.
    """
    print("[*] Rozpoczynam poszukiwanie historycznych alarmów (Mining 90 dni)...")
    import bearing_monitor as ai
    
    found_count = 0
    total_processed_points = 0
    
    # Sortowanie sensorów po SN dla ładnego logu
    sorted_sns = sorted(hwstate.sensor_history.keys())
    
    for sn in sorted_sns:
        df = hwstate.sensor_history[sn]
        if len(df) < 50: continue # Za mało danych do baseline
        
        try:
            # Uproszczona analiza historyczna blokami
            # (Nie chcemy spędzić tu 10 minut przy starcie)
            df_ai = df.copy()
            # Standaryzacja jednostek (g / °C)
            df_ai['unit'] = df_ai['unit'].str.replace('G', 'g').str.replace('c', '°C').str.replace('C', '°C')
            
            # Upewniamy się że index to datetime
            if not isinstance(df_ai.index, pd.DatetimeIndex):
                df_ai.index = pd.to_datetime(df_ai.index)
                
            df_ai = ai.prepare_bearing_data(df_ai)
            if df_ai.empty: continue
            
            df_ai = ai.analyze_skf_crest_factor(df_ai)
            df_ai = ai.analyze_siemens_baseline(df_ai)
            
            # Przekazanie temperatury z hali (Sensor 30001856) do kompensacji gradientu
            hall_temp_series = None
            if hwstate.settings.get("use_hall_compensation", True):
                if '30001856' in hwstate.sensor_history and not hwstate.sensor_history['30001856'].empty:
                    hall_temp_series = hwstate.sensor_history['30001856']['temp_mean']
                
            df_ai = ai.analyze_aws_gradient(df_ai, hall_temp=hall_temp_series)
            df_ai = ai.fuse_alarms(df_ai)
            
            total_processed_points += len(df_ai)
            
            # Wypisz jakie statusy znaleziono (tylko nienormalne)
            unique_verdicts = df_ai['FINAL_VERDICT'].unique()
            interesting = [v for v in unique_verdicts if v not in ['IDLE', '🟢 MONITORING', 'UNKNOWN', 'INAKTIV']]
            
            if interesting:
                print(f"  [MINING] {sn} ({hwstate.sensor_aliases.get(sn, sn)}): Wykryto {interesting}")

            # Znajdź alarmy (wyższe niż MONITORING)
            anomalies = df_ai[~df_ai['FINAL_VERDICT'].isin(['IDLE', '🟢 MONITORING', 'UNKNOWN'])]
            
            # Pobierz 1 najpoważniejszy alarm dziennie per sensor (żeby nie zaspamować logu)
            if not anomalies.empty:
                anomalies['day'] = anomalies.index.date
                daily_top = anomalies.sort_values(['day', 'max_priority'], ascending=[True, False]).drop_duplicates('day')
                
                for timestamp, row in daily_top.iterrows():
                    hwstate.event_history.append({
                        "sn": sn,
                        "alias": hwstate.sensor_aliases.get(sn, sn),
                        "timestamp": timestamp.isoformat(),
                        "type": row['FINAL_VERDICT'],
                        "msg": f"Historisk anomali: {row['alarm_source']}",
                        "vib_rms": float(row.get('vib_rms', 0.0)),
                        "temp_mean": float(row.get('temp_mean', 0.0)),
                        "temp_gradient": float(row.get('temp_gradient_final', 0.0))
                    })
                    found_count += 1
        except:
            continue
            
    if found_count > 0:
        print(f"[OK] Fant {found_count} historiske hendelser.")
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
                    print(f"[*] ZKompensacja halowa zmieniona na: {new_val}. Przeliczam historię...")
                    # Czyścimy historię zdarzeń
                    hwstate.event_history = []
                    if os.path.exists(EVENT_LOG_PATH):
                        os.remove(EVENT_LOG_PATH)
                    # Ustawienie flagi do re-miningu w pętli głównej
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

            print(f"[OK] Wykryto {len(devices)} wszystkich, z czego {len(filtered)} ma powiązanie z '{TAG_FILTER}'.")
            # Diagnostyka nazw dla użytkownika
            print("[*] Przykładowe aliasy dla linii Saglinje (pierwsze 20):")
            for sn_match in filtered[:20]:
                print(f"  - {sn_match} -> {hwstate.sensor_aliases.get(sn_match)}")
                
            return [f for f in filtered if f]
    except Exception as e:
        print(f"[CRITICAL] Błąd pobierania urządzeń: {e}")
        return []

def load_persistence(hwstate):
    """Wczytuje 90 dni historii z dysku (Parquet)"""
    path = PERSISTENCE_FILE
    if not os.path.exists(path):
        print("[!] Ingen historikkfil. Starter som ny.")
        return

    try:
        print(f"[*] Wczytuję historię z {PERSISTENCE_FILE}...")
        df_all = pd.read_parquet(PERSISTENCE_FILE)
        
        # Rozdzielamy na poszczególne sensory
        for sn, df_sn in df_all.groupby('sn'):
            # Upewniamy się że timestamp jest indexem i jest typu Datetime
            if 'timestamp' in df_sn.columns:
                df_sn['timestamp'] = pd.to_datetime(df_sn['timestamp'], unit='ms')
                df_sn = df_sn.set_index('timestamp')
            
            hwstate.sensor_history[str(sn)] = df_sn
            if not df_sn.empty:
                hwstate.last_timestamps[str(sn)] = int(df_sn.index.max().timestamp() * 1000)
        
        print(f"[OK] Załadowano historię dla {len(hwstate.sensor_history)} sensorów.")
    except Exception as e:
        print(f"[!] Błąd ładowania historii: {e}")

def save_persistence(hwstate):
    """Zrzuca całą historię z RAM do Parquet (90 dni)"""
    try:
        frames = []
        now = pd.Timestamp.now()
        cutoff_time = now - timedelta(days=RETENTION_DAYS)
        
        # Przycinanie RAM
        for sn in list(hwstate.sensor_history.keys()):
            df = hwstate.sensor_history[sn]
            if not df.empty:
                # Upewniamy się, że index jest czasowy przed porównaniem
                if not isinstance(df.index, pd.DatetimeIndex):
                    df.index = pd.to_datetime(df.index)
                hwstate.sensor_history[sn] = df[df.index >= cutoff_time]

        for sn, df in hwstate.sensor_history.items():
            if df.empty: continue
            # Przycinamy historię do RETENTION_DAYS przed zapisem
            df_filtered = df[df.index >= cutoff_time].copy()
            df_filtered['sn'] = sn
            # Eksportujemy index do kolumny by parquet go przechowal bezproblemowo
            df_to_save = df_filtered.reset_index()
            frames.append(df_to_save)
        
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
    load_event_history(hwstate)
    
    async with aiohttp.ClientSession() as session:
        # 2. Pobierz aktualną listę sensorów (z filtrem tagu)
        hwstate.active_sensors = await get_active_sensors(session, hwstate)
        
        if not hwstate.active_sensors:
            print("[ERROR] Ingen sensorer å overvåke etter filtrering. Sjekk tag 'saglinje'.")
            return

        # 3. WYMUŚ NATYCHMIASTOWY SNAPSHOT UI (żeby użytkownik od razu widział Aliasy)
        await push_snapshot_to_ui(hwstate)

        print(f"[*] Startuję pętlę monitoringu dla {len(hwstate.active_sensors)} maszyn...")
        
        cycle_count = 0
        while True:
            # Sprawdź zmiany w ustawieniach
            if load_settings(hwstate):
                # Trigger re-miningu historycznego przy zmianie ustawień
                print("[*] Ponowne przeszukiwanie historii po zmianie parametrów AI...")
                await mine_historical_events(hwstate)

            start_time = time.time()
            print(f"\n--- Cykl Polling #{cycle_count} (Sensorów: {len(hwstate.active_sensors)}) ---")
            
            try:
                await run_polling_cycle(session, hwstate)
                
                # JEDNORAZOWY MINING: Po pierwszym cyklu (gdy mamy już 90 dni w RAM)
                if cycle_count == 0 and not hwstate.event_history:
                    mine_historical_events(hwstate)
                    await push_snapshot_to_ui(hwstate) # Odśwież UI z nowymi zdarzeniami
            except Exception as e:
                print(f"[CRITICAL] Błąd w cyklu monitoringu: {e}")
            
            # Zapisuj stan na dysk częściej przy starcie (dla testów i pewności danych)
            cycle_count += 1
            if cycle_count <= 10 or cycle_count % 5 == 0:
                save_persistence(hwstate)
            
            elapsed = time.time() - start_time
            sleep_time = max(0, POLL_INTERVAL_SECONDS - elapsed)
            await asyncio.sleep(sleep_time)

if __name__ == "__main__":
    # Windows fix dla petli asyncio
    if os.name == 'nt':
         asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
         
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nZatrzymano Daemon UR Live ręcznie.")
