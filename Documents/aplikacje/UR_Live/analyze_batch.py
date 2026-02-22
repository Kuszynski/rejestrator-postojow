import sys
import io
import os
import pandas as pd
from datetime import datetime

# Wymuś UTF-8 dla konsoli Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except (AttributeError, io.UnsupportedOperation):
        pass

from bearing_monitor import (
    load_sensor_data, prepare_bearing_data, prepare_hall_data,
    analyze_skf_crest_factor, analyze_siemens_baseline,
    analyze_aws_gradient, analyze_rcf_anomaly,
    fuse_alarms, calculate_health_index
)

def analyze_batch(files, batch_id):
    print(f"\n{'='*60}")
    print(f"   AI BATCH ANALYSIS: MASKINGRUPPE (ID: {batch_id})")
    print(f"{'='*60}")

    hall_file = None
    sensor_files = []

    # 1. Auto-detect hall temperature vs sensors
    for f in files:
        if 'hala' in f.lower() or 'ambient' in f.lower():
            hall_file = f
        else:
            sensor_files.append(f)

    if hall_file:
        print(f"Bruk av halltemperatur: {hall_file}")
        try:
            df_hall_raw = load_sensor_data(hall_file)
            hall_temp = prepare_hall_data(df_hall_raw)
        except Exception as e:
            print(f"Feil ved lasting av halltemperatur: {e}")
            hall_temp = None
    else:
        print("Ingen halltemperatur oppdaget. Kjører uten kompensasjon.")
        hall_temp = None

    if not sensor_files:
        print("Ingen sensorfiler funnet i batchen.")
        return

    # 2. Process each sensor
    for file_path in sensor_files:
        if not os.path.exists(file_path):
            print(f"Feil: Finner ikke {file_path}")
            continue
            
        # Extract sensor name
        sensor_sn = os.path.basename(file_path).replace('.csv', '').replace('sensor_', '').replace('dane_lozysko_projekt', '')
        output_path = f'raport_batch_{batch_id}_{sensor_sn}.csv'
        
        print(f"--> Analyserer sensor: {sensor_sn} ...")
        
        try:
            df_raw = load_sensor_data(file_path)
            df = prepare_bearing_data(df_raw)
            df['sn'] = sensor_sn
            df['batch_id'] = batch_id
            df['avg_line_vibration'] = df['vib_rms']
            
            # Run analytics with hall temp compensation if available
            df = analyze_skf_crest_factor(df)
            df = analyze_siemens_baseline(df)
            df = analyze_aws_gradient(df, hall_temp=hall_temp)
            df = analyze_rcf_anomaly(df)
            df = fuse_alarms(df)
            df = calculate_health_index(df)
            
            # Save individual processed output for this batch
            df.to_csv(output_path, sep=';')
            print(f"    Lagret til: {output_path}")
            
        except Exception as e:
            print(f"    Kritisk feil ved analyse av {sensor_sn}: {e}")

    print("\nBatch-analyse fullført.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Bruk: python analyze_batch.py <batch_id> <file1.csv> [file2.csv ...]")
        sys.exit(1)
        
    batch_id = sys.argv[1]
    input_files = sys.argv[2:]
    
    analyze_batch(input_files, batch_id)
