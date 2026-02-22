
import aiohttp
import asyncio
import json
import os
import pandas as pd

API_BASE_URL = "https://api.neuronsensors.app/v2"
API_KEY = "jP4UeJ8RBN5sX5FdTtKLlHDEEc9nbYlUz/s8UyikfiI="
SYSTEM_ID = "nIwosVxCrK9RTctvb90X"

async def test():
    sn = "21001564"
    url = f"{API_BASE_URL}/systems/{SYSTEM_ID}/devices/{sn}/samples?limit=5"
    headers = { "ApiKey": API_KEY }
    
    async with aiohttp.ClientSession() as session:
        async with session.get(url, headers=headers) as response:
            print(f"Status: {response.status}")
            data = await response.json()
            print("RAW DATA SAMPLE:")
            print(json.dumps(data, indent=2))

if __name__ == "__main__":
    asyncio.run(test())
