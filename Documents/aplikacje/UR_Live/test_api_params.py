import urllib.request, json
import time

API_KEY = "jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI="
SYSTEM_ID = "nIwosVxCrK9RTctvb90X"
SN = "21001657"
now_ms = int(time.time() * 1000)
past_ms = now_ms - 100 * 24 * 3600 * 1000

urls = [
    f"https://api.neuronsensors.app/v2/systems/{SYSTEM_ID}/devices/{SN}/samples?from={past_ms}&to={now_ms}&limit=1000",
    f"https://api.neuronsensors.app/v2/systems/{SYSTEM_ID}/devices/{SN}/samples?startDate={past_ms}&endDate={now_ms}&limit=1000",
    f"https://api.neuronsensors.app/v2/systems/{SYSTEM_ID}/devices/{SN}/samples?start={past_ms}&end={now_ms}&limit=1000",
]

for url in urls:
    req = urllib.request.Request(url, headers={"ApiKey": API_KEY})
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            extracted = []
            if isinstance(data, list): extracted = data
            elif data and isinstance(data.get('items'), list): extracted = data['items']
            elif data and isinstance(data, dict):
                for v in data.values():
                    if isinstance(v, list):
                        extracted = v
                        break
            print(f"URL: {url.split('?')[1]}\n -> Got {len(extracted)} samples. First item: {extracted[0] if extracted else 'N/A'}\n")
    except Exception as e:
        print(f"URL: {url.split('?')[1]}\n -> Error: {e}\n")
