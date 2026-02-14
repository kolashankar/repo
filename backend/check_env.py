import os
print(f"MONGO_URL from environment: {os.environ.get('MONGO_URL', 'Not Set')}")