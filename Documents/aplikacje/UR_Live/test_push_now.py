import requests

url = "https://api.pushover.net/1/messages.json"
payload = {
    "token": "abcuu941s9jftnpbqpxpemw4cqgzas",
    "user": "uypxajic1hdgo9838ha82eafh2oq16",
    "title": "Test Alarm UR",
    "message": "Test: Maskin: 2050 Sponskrue 4\nTemp: 19.9C (+16.8C/h)\nVib: 0.30g\nKilde: AWS Monitron (Gradient temp.)",
    "priority": 0,
    "sound": "magic"
}

try:
    r = requests.post(url, data=payload, timeout=10)
    print("Status:", r.status_code)
    print("Response:", r.text)
except Exception as e:
    print("Error:", e)
