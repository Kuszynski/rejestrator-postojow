import requests
import json

API_KEY = "jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI="
SYSTEM_ID = "nIwosVxCrK9RTctvb90X"

def debug_api():
    # 1. Sprawdz listę systemów
    url_systems = "https://api.neuronsensors.app/v2/systems"
    r = requests.get(url_systems, headers={"ApiKey": API_KEY})
    print(f"Systems API Status: {r.status_code}")
    if r.status_code == 200:
        print("Systems List Sample:", r.json()[:2])
        
    # 2. Sprawdz urządzenia dla SYSTEM_ID
    url_devices = f"https://api.neuronsensors.app/v2/systems/{SYSTEM_ID}/devices"
    r = requests.get(url_devices, headers={"ApiKey": API_KEY})
    print(f"Devices API Status: {r.status_code}")
    if r.status_code == 200:
        data = r.json()
        print(f"Data type: {type(data)}")
        if isinstance(data, list):
            print(f"Device List Length: {len(data)}")
            if len(data) > 0:
                print("First Device Sample:", json.dumps(data[0], indent=2))
        elif isinstance(data, dict):
            print(f"Keys: {data.keys()}")
            
if __name__ == "__main__":
    debug_api()
