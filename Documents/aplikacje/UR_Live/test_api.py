import urllib.request, json
url = "https://api.neuronsensors.com/systems/14494101/devices/21001657/samples?from=" + str(1707834241000) + "&to=" + str(1710427329000) + "&limit=2"
req = urllib.request.Request(url, headers={"ApiKey": "M5M4u8T3H162777r27993y7Q33H1H5H0"})
try:
    with urllib.request.urlopen(req) as response:
        data = json.loads(response.read().decode())
        print(json.dumps(data, indent=2))
except Exception as e:
    print(e)
