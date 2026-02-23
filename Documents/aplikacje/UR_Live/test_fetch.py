import asyncio
import aiohttp
import time
import pandas as pd
from datetime import datetime

API_KEY = "jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI="
SYSTEM_ID = "nIwosVxCrK9RTctvb90X"
API_BASE_URL = "https://api.neuronsensors.app/v2"
SN = "21001554"

async def test_fetch():
    now_ts = int(time.time() * 1000)
    current_last_ts = now_ts - 5 * 24 * 60 * 60 * 1000
    all_extracted = []

    async with aiohttp.ClientSession() as session:
        for i in range(10):
            print(f"Iter {i}, current_last_ts: {current_last_ts}")
            chunk_to = min(current_last_ts + 15 * 24 * 60 * 60 * 1000, now_ts)
            url = f"{API_BASE_URL}/systems/{SYSTEM_ID}/devices/{SN}/samples?from={current_last_ts}&to={chunk_to}&limit=5000"
            headers = {"ApiKey": API_KEY}
            print(f"URL: {url}")
            
            try:
                t0 = time.time()
                async with session.get(url, headers=headers, timeout=60) as response:
                    print(f"Req time: {time.time() - t0:.2f}s, Status: {response.status}")
                    if response.status != 200:
                        break
                    data = await response.json()
                    
                    extracted = []
                    if isinstance(data, list): extracted = data
                    elif data and isinstance(data.get('items'), list): extracted = data['items']
                    
                    print(f"Extracted {len(extracted)} items")
                    if not extracted:
                        all_extracted.extend(extracted)
                        print("No data, advancing chunk")
                        current_last_ts = chunk_to + 1
                        if current_last_ts >= now_ts: break
                        continue
                        
                    all_extracted.extend(extracted)
                    
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
                            pass
                    
                    print(f"max_ts: {max_ts}, limit={5000}")
                    if max_ts <= current_last_ts:
                        current_last_ts = chunk_to + 1
                    elif len(extracted) < 5000:
                        current_last_ts = chunk_to + 1
                    else:    
                        current_last_ts = max_ts + 1
                        
                    if current_last_ts >= now_ts: break
            except Exception as e:
                print(f"Exception: {e}")
                break

    print(f"Total extracted: {len(all_extracted)}")

asyncio.run(test_fetch())
