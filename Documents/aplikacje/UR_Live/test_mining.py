import asyncio
import os
import aiohttp
from live_daemon import HardwareState, load_persistence, mine_historical_events, run_polling_cycle, get_active_sensors

async def extract():
    print("Loading hardware state...")
    hw = HardwareState()
    load_persistence(hw)
    
    # We must have active sensors to do anything
    async with aiohttp.ClientSession() as session:
        hw.active_sensors = await get_active_sensors(session, hw)
        print(f"Loaded {len(hw.active_sensors)} sensors")
        
        # We need historical data loaded in memory so run at least one polling cycle
        print("Running one polling cycle to fetch history...")
        await run_polling_cycle(session, hw)
        
        print("Running mining extraction...")
        await mine_historical_events(hw)
        
if __name__ == '__main__':
    if os.path.exists("mining_debug.log"):
        os.remove("mining_debug.log")
    asyncio.run(extract())
