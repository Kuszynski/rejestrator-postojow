import pandas as pd
import sys
import json
import warnings
import os

warnings.filterwarnings('ignore')

try:
    if len(sys.argv) < 2:
        raise ValueError("Missing 'sn' parameter")
        
    sn = sys.argv[1]
    
    # Path is relative or absolute to the calling backend.
    # The API route runs in 'dashboard' so the parquet file is one directory up.
    parquet_path = os.path.join(os.path.dirname(__file__), 'sensor_history.parquet')
    
    df_raw = pd.read_parquet(parquet_path, filters=[('sn', '==', sn)])
    
    if df_raw.empty:
        print(json.dumps({"status": "ok", "data": []}))
        sys.exit(0)
        
    df_raw['timestamp'] = pd.to_datetime(df_raw['timestamp'], unit='ms').dt.tz_localize('UTC').dt.tz_convert('Europe/Warsaw').dt.tz_localize(None)
    
    unit_map = {'C': '°C', 'c': '°C', 'G': 'g', 'g': 'g'}
    df_raw['unit'] = df_raw['unit'].apply(lambda x: unit_map.get(x, x))
    
    df_tmp = df_raw.copy()
    df_tmp['unit'] = df_tmp['unit'].replace({'°C': 'temp_mean', 'g': 'vib_rms'})
    
    df_pivot = df_tmp.pivot_table(index='timestamp', columns='unit', values='value', aggfunc='mean')
    df_pivot = df_pivot.sort_index()
    
    # Filter to last 14 days maximum to keep UI fast even if there are months of data
    max_ts = df_pivot.index.max()
    min_ts_limit = max_ts - pd.Timedelta(days=14)
    df_pivot = df_pivot[df_pivot.index >= min_ts_limit]
    
    # Resample to 20-minute intervals
    df_pivot = df_pivot.resample('20T').mean().dropna(how='all')
    
    df_pivot = df_pivot.reset_index()
    
    res = []
    for _, row in df_pivot.iterrows():
        res.append({
            "timestamp": row['timestamp'].isoformat(), # Zostawiamy ISO format dla JS
            "temp_mean": round(row['temp_mean'], 2) if 'temp_mean' in row and pd.notnull(row['temp_mean']) else None,
            "vib_rms": round(row['vib_rms'], 3) if 'vib_rms' in row and pd.notnull(row['vib_rms']) else None
        })
        
    print(json.dumps({"status": "ok", "data": res}))
    
except Exception as e:
    print(json.dumps({"status": "error", "message": str(e)}))
