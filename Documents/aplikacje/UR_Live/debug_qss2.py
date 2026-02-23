import pandas as pd
import json
import bearing_monitor as ai

def main():
    df_all = pd.read_parquet('sensor_history.parquet')
    aliases = json.load(open('live_status.json'))['sensors']
    sn_map = {a['alias']: a['sn'] for a in aliases if a['alias'] == '1780 el motor NDE QSS-700 N.V'}
    sn = sn_map['1780 el motor NDE QSS-700 N.V']
    
    c_df = df_all[df_all['sn'] == sn].copy()
    c_df['timestamp'] = pd.to_datetime(c_df['timestamp'], unit='ms', utc=True).dt.tz_convert('Europe/Warsaw').dt.tz_localize(None)
    prep_df = ai.prepare_bearing_data(c_df)
    
    d = prep_df.copy()
    d = ai.analyze_skf_crest_factor(d, True)
    ai.SIEMENS_BASELINE_WINDOW = 30 * 24 * 12
    d = ai.analyze_siemens_baseline(d)
    ai.AWS_GRADIENT_WINDOW = 12
    d = ai.analyze_aws_gradient(d, hall_temp=None)
    d = ai.analyze_rcf_anomaly(d)
    d = ai.fuse_alarms(d, True)
    
    mask = (d.index >= '2026-02-23 17:30') & (d.index <= '2026-02-23 18:00')
    cols = ['vib_rms', 'temp_mean', 'temp_gradient_final', 'aws_status', 'siemens_status', 'FINAL_VERDICT', 'is_rundown']
    print(d.loc[mask, cols])

if __name__ == '__main__':
    main()
