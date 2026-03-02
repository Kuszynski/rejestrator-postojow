import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import sys
import os

# Import implementation from the main file
sys.path.append(r'c:\Users\micha\Documents\aplikacje\UR_Live')
from bearing_monitor import prepare_bearing_data, analyze_aws_gradient, HEAVY_KEYWORDS

def test_safety_logic():
    print("RUNNING VERIFICATION OF DUAL-LAYER SAFETY LOGIC...")
    
    # ---------------------------------------------------------
    # SCENARIO 1: Today's False Positive (QSS-700, +17.1°C/h at 55 mins)
    # ---------------------------------------------------------
    print("\n--- Scenario 1: QSS-700 Morning Start (+17.1°C/h at 55 mins) ---")
    start_time = datetime(2026, 3, 2, 6, 0)
    data = []
    
    # 06:00 to 07:00 (12 intervals of 5 mins)
    for i in range(13):
        t = start_time + timedelta(minutes=i*5)
        # Linear rise from 20°C to ~37°C (+17°C/h)
        temp = 20.0 + (i * 5 / 60) * 17.1
        data.append({'timestamp': t, 'unit': '°C', 'value': temp, 'sn': '21008097 (1780 el motor NDE QSS-700 Ø.V)'})
        data.append({'timestamp': t, 'unit': 'g', 'value': 0.8, 'sn': '21008097 (1780 el motor NDE QSS-700 Ø.V)'})

    df_raw = pd.DataFrame(data)
    # Filter for the specific SN
    sn = '21008097 (1780 el motor NDE QSS-700 Ø.V)'
    sensor_data = df_raw[df_raw['sn'] == sn]
    
    is_heavy = any(k.upper() in sn.upper() for k in HEAVY_KEYWORDS)
    print(f"Is Heavy: {is_heavy}")
    
    df_agg = prepare_bearing_data(sensor_data, is_heavy=is_heavy)
    df_final = analyze_aws_gradient(df_agg, is_heavy=is_heavy)
    
    # Check at 06:55 (11th interval)
    check_time = datetime(2026, 3, 2, 6, 55)
    status = df_final.loc[check_time, 'aws_status']
    grad = df_final.loc[check_time, 'temp_gradient_final']
    is_warmup = df_final.loc[check_time, 'is_warmup']
    
    print(f"Time: {check_time} | Grad: {grad:.2f} | Warmup: {is_warmup} | Status: {status}")
    if status == '🟢 MONITORING':
        print("✅ SUCCESS: False positive suppressed during extended warmup.")
    else:
        print(f"❌ FAILURE: Expected MONITORING, got {status}")

    # ---------------------------------------------------------
    # SCENARIO 2: Feb 13 Fire Simulation (+26°C/h at 40 mins)
    # ---------------------------------------------------------
    print("\n--- Scenario 2: Feb 13 Fire Simulation (+26°C/h at 40 mins) ---")
    data_fire = []
    for i in range(13):
        t = start_time + timedelta(minutes=i*5)
        # Normal rise for first 20 mins, then sudden jump
        if i < 4:
            temp = 20.0 + (i * 5 / 60) * 10.0
        else:
            # Jump to hit >25°C/h gradient
            temp = 20.0 + (i * 5 / 60) * 26.0
            
        data_fire.append({'timestamp': t, 'unit': '°C', 'value': temp, 'sn': '21008097 (1780 el motor NDE QSS-700 Ø.V)'})
        data_fire.append({'timestamp': t, 'unit': 'g', 'value': 0.8, 'sn': '21008097 (1780 el motor NDE QSS-700 Ø.V)'})

    df_raw_fire = pd.DataFrame(data_fire)
    df_agg_fire = prepare_bearing_data(df_raw_fire, is_heavy=is_heavy)
    df_final_fire = analyze_aws_gradient(df_agg_fire, is_heavy=is_heavy)
    
    # Check at 06:40 (8th interval)
    check_time_fire = datetime(2026, 3, 2, 6, 40)
    status_fire = df_final_fire.loc[check_time_fire, 'aws_status']
    grad_fire = df_final_fire.loc[check_time_fire, 'temp_gradient_final']
    
    print(f"Time: {check_time_fire} | Grad: {grad_fire:.2f} | Status: {status_fire}")
    if 'BRANN/STOPP' in str(status_fire) or 'KRITISK ALARM' in str(status_fire):
        print("✅ SUCCESS: Fire detected despite being in warmup period (Safety Override).")
    else:
        print(f"❌ FAILURE: Fire NOT detected during warmup. Status: {status_fire}")

if __name__ == "__main__":
    test_safety_logic()
