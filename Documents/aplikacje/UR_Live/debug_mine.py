import pandas as pd
import json
from datetime import datetime
import bearing_monitor as ai

def main():
    df = pd.read_parquet('sensor_history.parquet')
    sn = '21002378' # 1300.20 El motor RE rotor NDE
    c_df = df[df['sn'] == sn].copy()
    c_df['timestamp'] = pd.to_datetime(c_df['timestamp'], unit='ms', utc=True).dt.tz_convert('Europe/Warsaw').dt.tz_localize(None)
    
    prep_df = ai.prepare_bearing_data(c_df)
    
    def _mine_pipeline(input_df, use_hall):
        d = input_df.copy()
        d = ai.analyze_skf_crest_factor(d)
        d = ai.analyze_siemens_baseline(d)
        
        # Omijamy halowe dla uproszczenia
        d = ai.analyze_aws_gradient(d, hall_temp=None)
        d = ai.fuse_alarms(d)
        return d
        
    df_raw = _mine_pipeline(prep_df, False)
    
    # Wyświetlamy feralny wycinek:
    print("Wyniki analizy dla 12.02 okolic 22:45")
    mask = (df_raw.index >= '2026-02-12 22:30') & (df_raw.index <= '2026-02-12 23:30')
    print(df_raw.loc[mask, ['vib_rms', 'FINAL_VERDICT', 'max_priority', 'skf_status', 'siemens_status', 'aws_status', 'rcf_status', 'is_rundown']])

if __name__ == '__main__':
    main()
