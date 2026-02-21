"""MongoDB connection and profile collection helpers."""

from pymongo import MongoClient
from datetime import datetime

# --- Connection ---
MONGO_URI = "mongodb+srv://gdg_db_user:Gd8RUs7SnXXU9hdm@cluster0.de4d26o.mongodb.net/?appName=Cluster0"
DB_NAME = "day_planner"

client: MongoClient = None
db = None


def get_db():
    """Get or create the MongoDB connection."""
    global client, db
    if client is None:
        client = MongoClient(MONGO_URI)
        db = client[DB_NAME]
        # Ensure indexes
        db.profiles.create_index("user_id", unique=True)
        db.sleep_logs.create_index([("user_id", 1), ("logged_at", -1)])
        print(f"[DB] Connected to MongoDB: {DB_NAME}")
    return db


def close_db():
    """Close the MongoDB connection."""
    global client, db
    if client:
        client.close()
        client = None
        db = None
        print("[DB] MongoDB connection closed")


# --- Profile Operations ---

def save_profile(user_id: str, profile_data: dict) -> dict:
    """Save or update a user profile. Returns the saved profile."""
    database = get_db()
    profile_data["user_id"] = user_id
    profile_data["updated_at"] = datetime.utcnow().isoformat()

    result = database.profiles.update_one(
        {"user_id": user_id},
        {"$set": profile_data, "$setOnInsert": {"created_at": datetime.utcnow().isoformat()}},
        upsert=True,
    )

    saved = database.profiles.find_one({"user_id": user_id}, {"_id": 0})
    return saved or profile_data


def get_profile(user_id: str) -> dict | None:
    """Get a user profile by user_id."""
    database = get_db()
    return database.profiles.find_one({"user_id": user_id}, {"_id": 0})


# --- Sleep Log Operations ---

def save_sleep_log(user_id: str, bedtime: str, wake_time: str = None) -> dict:
    """Save a sleep log entry."""
    database = get_db()
    entry = {
        "user_id": user_id,
        "bedtime": bedtime,
        "wake_time": wake_time,
        "logged_at": datetime.utcnow().isoformat(),
    }
    database.sleep_logs.insert_one(entry)
    entry.pop("_id", None)
    return entry


def get_sleep_logs(user_id: str, limit: int = 7) -> list:
    """Get recent sleep logs for a user."""
    database = get_db()
    logs = list(
        database.sleep_logs.find(
            {"user_id": user_id}, {"_id": 0}
        ).sort("logged_at", -1).limit(limit)
    )
    return logs
