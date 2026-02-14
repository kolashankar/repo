import os
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv

load_dotenv('/app/backend/.env')
MONGO_URL = os.getenv('MONGO_URL')

print(f"Connecting to: {MONGO_URL}")

async def test_mongo():
    try:
        client = AsyncIOMotorClient(MONGO_URL)
        await client.admin.command('ping')
        print("Connected successfully!")
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_mongo())