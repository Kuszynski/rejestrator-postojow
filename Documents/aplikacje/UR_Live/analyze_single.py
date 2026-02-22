import pandas as pd
import numpy as np
import os
from bearing_monitor import (
    load_sensor_data, prepare_bearing_data, 
    analyze_skf_crest_factor, analyze_siemens_baseline,
    analyze_aws_gradient, analyze_rcf_anomaly,
    fuse_alarms, calculate_health_index
)

import sys

def analyze_new_sensor(file_path):
    # Output file based on sensor name
    sensor_sn = os.path.basename(file_path).replace('.csv', '').replace('sensor_', '')
    output_path = f'raport_sensor_{sensor_sn}.csv'
    
    print(f"\n{'='*60}")
    print(f"   AI BLIND TEST: POSZUKIWANIE AWARII")
    print(f"   Plik: {file_path}")
    print(f"   Zapis do: {output_path}")
    print(f"{'='*60}")

    if not os.path.exists(file_path):
        print(f"Error: File {file_path} not found.")
        return

    # 1. Load data
    df_raw = load_sensor_data(file_path)
    
    # 2. Aggregation
    df = prepare_bearing_data(df_raw)
    df['sn'] = sensor_sn
    df['avg_line_vibration'] = df['vib_rms']
    
    # 3. Running Analytics Cascade
    df = analyze_skf_crest_factor(df)
    df = analyze_siemens_baseline(df)
    df = analyze_aws_gradient(df, hall_temp=None)
    df = analyze_rcf_anomaly(df)
    df = fuse_alarms(df)
    df = calculate_health_index(df)

    # 4. Search for Failure Point (Blindly)
    # Failure point is usually the highest temp combined with low vibration AFTER a peak
    peak_idx = df['temp_mean'].idxmax()
    failure_day = peak_idx.strftime('%Y-%m-%d')
    day_df = df[df.index.strftime('%Y-%m-%d') == failure_day].copy()

    print(f"\n--- WYNIKI WYKRYWANIA (Dzień: {failure_day}) ---")
    
    # Real failure time defined by data
    try:
        real_failure_time = day_df[(day_df['temp_mean'] > 90) | 
                                   ((day_df['vib_rms'] < 0.1) & (day_df.index > day_df['vib_rms'].idxmax()))].index.min()
        
        # First indicator: Anything non-green before real_failure_time
        warnings = day_df[(day_df.index < real_failure_time) & 
                          (~day_df['FINAL_VERDICT'].isin(['IDLE', '🟢 MONITORING']))]
        
        if not warnings.empty:
            first_warning = warnings.index.min()
            lead_time = real_failure_time - first_warning
            
            print(f"🔥 KATASTROFA WYKRYTA O:      {real_failure_time}")
            print(f"🟡 PIERWSZE OSTRZEŻENIE AI:    {first_warning}")
            print(f"⏱️  ZŁOTY CZAS NA REAKCJĘ:      {lead_time}")
            print(f"\nUzasadnienie pierwszego ostrzeżenia:")
            print(day_df.loc[first_warning][['temp_mean', 'vib_rms', 'temp_gradient_final', 'FINAL_VERDICT', 'alarm_source']])
        else:
            print("AI nie wykryło wczesnych sygnałów ostrzegawczych przed szczytem.")
    except Exception as e:
        print(f"Nie udało się jednoznacznie wskazać momentu awarii: {e}")

    # Save for dashboard
    df.to_csv(output_path, sep=';')
    print(f"\nPełny raport zapisany do: {output_path}")

if __name__ == "__main__":
    target_file = sys.argv[1] if len(sys.argv) > 1 else 'sensor_21009224.csv'
    analyze_new_sensor(target_file)
