import pandas as pd
import json
import bearing_monitor as ai

def main():
    aliases = json.load(open('live_status.json'))['sensors']
    
    target_aliases = [
        "1780 el motor NDE QSS-700 Ø.H",
        "1780 el motor NDE QSS-700 Ø.V",
        "1780 el motor DE QSS-700 N.V"
    ]
    
    sn_map = {a['alias']: a['sn'] for a in aliases if a['alias'] in target_aliases}
    print("Mapowanie sensorow:", sn_map)
    
    df_all = pd.read_parquet('sensor_history.parquet')
    
    for alias, sn in sn_map.items():
        print(f"\n=========================================")
        print(f"BADAJĄC: {alias} (SN: {sn})")
        print(f"=========================================")
        
        c_df = df_all[df_all['sn'] == sn].copy()
        c_df['timestamp'] = pd.to_datetime(c_df['timestamp'], unit='ms', utc=True).dt.tz_convert('Europe/Warsaw').dt.tz_localize(None)
        
        prep_df = ai.prepare_bearing_data(c_df)
        
        if prep_df.empty:
            print("Brak danych.")
            continue
            
        is_heavy_impact = True
        
        # Odtwarzamy rurociąg
        d = prep_df.copy()
        
        d = ai.analyze_skf_crest_factor(d, is_heavy_impact)
        ai.SIEMENS_BASELINE_WINDOW = 30 * 24 * 12
        d = ai.analyze_siemens_baseline(d)
        ai.AWS_GRADIENT_WINDOW = 12
        d = ai.analyze_aws_gradient(d, hall_temp=None)
        d = ai.analyze_rcf_anomaly(d)
        d = ai.fuse_alarms(d, is_heavy_impact)
        
        # Feralne okno czasowe:
        mask = (d.index >= '2026-02-13 06:00') & (d.index <= '2026-02-13 09:00')
        anomalies = d.loc[mask & (d['max_priority'] >= 3)]
        
        if anomalies.empty:
            print("BRAK ZDARZEŃ >= PLANLEGG SERVICE w tym okresie.")
            print("\nOstatnie próbki tuż przed i w trakcie rzekomej usterki (06:45 - 08:30):")
            sample_mask = (d.index >= '2026-02-13 06:45') & (d.index <= '2026-02-13 08:30')
            cols = ['vib_rms', 'temp_mean', 'temp_gradient_final', 'FINAL_VERDICT', 'is_warmup']
            print(d.loc[sample_mask, cols].head(20))
        else:
            print("WYKRYTO ZDARZENIA! Oto logi:")
            cols = ['vib_rms', 'temp_mean', 'temp_gradient_final', 'aws_status', 'siemens_status', 'FINAL_VERDICT', 'is_warmup']
            print(anomalies[cols])

if __name__ == '__main__':
    main()
