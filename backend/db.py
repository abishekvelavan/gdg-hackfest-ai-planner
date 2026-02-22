"""MongoDB connection and profile collection helpers."""

import os
from pymongo import MongoClient
from datetime import datetime
import hashlib
import secrets
import certifi

# --- Connection ---
MONGO_URI = os.getenv(
    "MONGO_URI",
    "mongodb+srv://gdg_db_user:Gd8RUs7SnXXU9hdm@cluster0.de4d26o.mongodb.net/?appName=Cluster0",
)
DB_NAME = "day_planner"

client: MongoClient = None
db = None


def get_db():
    """Get or create the MongoDB connection."""
    global client, db
    if client is None:
        client = MongoClient(MONGO_URI, tlsCAFile=certifi.where(), tlsAllowInvalidCertificates=True)
        db = client[DB_NAME]
        # Ensure indexes
        db.profiles.create_index("user_id", unique=True)
        db.sleep_logs.create_index([("user_id", 1), ("logged_at", -1)])
        db.users.create_index("email", unique=True)
        db.google_tokens.create_index("user_id", unique=True)
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


# --- Auth Operations ---

def _hash_password(password: str, salt: str = None) -> tuple[str, str]:
    """Hash a password with salt. Returns (hash, salt)."""
    if salt is None:
        salt = secrets.token_hex(16)
    hashed = hashlib.sha256((salt + password).encode()).hexdigest()
    return hashed, salt


def register_user(email: str, password: str, name: str = "") -> dict:
    """Register a new user. Returns user dict or raises ValueError."""
    database = get_db()
    # Check if user already exists
    existing = database.users.find_one({"email": email.lower().strip()})
    if existing:
        raise ValueError("Email already registered")
    
    hashed, salt = _hash_password(password)
    user_id = secrets.token_hex(12)  # 24-char unique ID
    
    user = {
        "user_id": user_id,
        "email": email.lower().strip(),
        "name": name.strip(),
        "password_hash": hashed,
        "password_salt": salt,
        "created_at": datetime.utcnow().isoformat(),
    }
    database.users.insert_one(user)
    # Return without password fields
    return {"user_id": user_id, "email": user["email"], "name": user["name"]}


def login_user(email: str, password: str) -> dict:
    """Login a user. Returns user dict or raises ValueError."""
    database = get_db()
    user = database.users.find_one({"email": email.lower().strip()})
    if not user:
        raise ValueError("Invalid email or password")
    
    hashed, _ = _hash_password(password, user["password_salt"])
    if hashed != user["password_hash"]:
        raise ValueError("Invalid email or password")
    
    return {"user_id": user["user_id"], "email": user["email"], "name": user["name"]}


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


# --- Google OAuth Tokens (per user) ---

def save_google_tokens(user_id: str, tokens: dict) -> None:
    """Save or update Google OAuth tokens for a user."""
    database = get_db()
    doc = {
        "user_id": user_id,
        "tokens": tokens,
        "updated_at": datetime.utcnow().isoformat(),
    }
    database.google_tokens.update_one(
        {"user_id": user_id},
        {"$set": doc, "$setOnInsert": {"created_at": datetime.utcnow().isoformat()}},
        upsert=True,
    )


def get_google_tokens(user_id: str) -> dict | None:
    """Get Google OAuth tokens for a user, or None if not connected."""
    database = get_db()
    row = database.google_tokens.find_one({"user_id": user_id})
    if not row:
        return None
    return row.get("tokens")
