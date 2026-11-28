import asyncio
import os
import sys

# Add the 'app' folder to the Python path so it can find drivers.py
sys.path.insert(0, os.path.join(os.getcwd(), "app"))

from driver import PlaywrightFlowDriver, Job

async def main():
    print("🚀 Starting test generation...")
    
    driver = PlaywrightFlowDriver()
    
    job = Job(
        id="test_001",
        prompt="A cinematic shot of a futuristic cyberpunk city at night, neon lights, 8k resolution",
        aspect="16:9"
    )
    
    try:
        image_bytes = await driver.generate(job, "../accounts/alice.json")
        
        with open("result.png", "wb") as f:
            f.write(image_bytes)
        print("✅ Success! Image saved as result.png")
        
    except Exception as e:
        print(f"❌ Failed: {e}")

if __name__ == "__main__":
    os.environ["FLOW_STEALTH_DEBUG"] = "1"
    os.environ["FLOW_HEADLESS"] = "0"
    
    asyncio.run(main())
