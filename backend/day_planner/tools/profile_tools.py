"""Profile management tools for the Day Planner agent.

Handles user onboarding, preference storage, and profile persistence.
Stores work hours, energy type, locations, transport preferences, etc.
"""

import json
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
PROFILE_PATH = DATA_DIR / "user_profile.json"


def _load_profile() -> dict:
    """Load user profile from JSON file."""
    try:
        data = json.loads(PROFILE_PATH.read_text())
        return data if isinstance(data, dict) else {}
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_profile(profile: dict):
    """Save user profile to JSON file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    PROFILE_PATH.write_text(json.dumps(profile, indent=2))


def is_onboarding_needed() -> dict:
    """Check if the user needs to go through first-time onboarding.

    Returns:
        Dictionary indicating whether onboarding is needed and what
        fields are missing.
    """
    profile = _load_profile()
    required_fields = ["name", "work_hours", "home_address", "energy_type"]
    missing = [f for f in required_fields if f not in profile or not profile[f]]

    return {
        "onboarding_needed": len(missing) > 0,
        "has_profile": len(profile) > 0,
        "missing_fields": missing,
        "message": (
            "Welcome! I need to learn about you first to create great plans."
            if missing
            else "Profile is set up! Ready to plan your day."
        ),
    }


def get_user_profile() -> dict:
    """Get the current user profile with all preferences.

    Returns:
        Dictionary with all stored user preferences, or an empty profile
        indicator if no profile exists.
    """
    profile = _load_profile()

    if not profile:
        return {
            "has_profile": False,
            "message": "No profile found. Please complete onboarding first.",
        }

    return {
        "has_profile": True,
        **profile,
    }


def save_user_profile(
    name: str = "",
    work_hours: str = "",
    home_address: str = "",
    office_address: str = "",
    gym_address: str = "",
    grocery_store_address: str = "",
    energy_type: str = "",
    peak_focus_hours: str = "",
    preferred_exercise_time: str = "",
    preferred_transport: str = "",
    hobbies: str = "",
    sleep_target_hours: float = 7.5,
) -> dict:
    """Save or update user profile preferences.

    All parameters are optional — only provided values will be updated.
    Existing values are preserved if a parameter is empty.

    Args:
        name: User's name.
        work_hours: Work/school schedule (e.g., "9 AM - 5 PM").
        home_address: Home address for routing.
        office_address: Office/school address for routing.
        gym_address: Gym address for routing.
        grocery_store_address: Grocery store address for routing.
        energy_type: "morning_person" or "night_owl".
        peak_focus_hours: Hours of maximum focus (e.g., "9 AM - 12 PM").
        preferred_exercise_time: When to exercise (e.g., "evening", "morning").
        preferred_transport: Default transport mode ("car", "bike", "public_transit", "walk").
        hobbies: Comma-separated list of hobbies.
        sleep_target_hours: Target sleep duration in hours.

    Returns:
        Dictionary confirming the saved profile.
    """
    profile = _load_profile()

    # Only update fields that are provided (non-empty)
    updates = {
        "name": name,
        "work_hours": work_hours,
        "home_address": home_address,
        "office_address": office_address,
        "gym_address": gym_address,
        "grocery_store_address": grocery_store_address,
        "energy_type": energy_type,
        "peak_focus_hours": peak_focus_hours,
        "preferred_exercise_time": preferred_exercise_time,
        "preferred_transport": preferred_transport,
        "hobbies": hobbies,
        "sleep_target_hours": sleep_target_hours,
    }

    for key, value in updates.items():
        if value:  # Only update if value is truthy
            profile[key] = value

    _save_profile(profile)

    return {
        "message": "Profile saved successfully!",
        "profile": profile,
    }
