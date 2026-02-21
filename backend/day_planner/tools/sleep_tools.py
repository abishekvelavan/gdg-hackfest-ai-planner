"""Sleep tracking tools for the Day Planner agent.

Logs bedtime, calculates wake-up time based on user's sleep target,
manages sleep history, and provides data for the scheduler to create
morning alarms.
"""

import json
from datetime import datetime, timedelta
from pathlib import Path

DATA_DIR = Path(__file__).parent.parent / "data"
SLEEP_LOG_PATH = DATA_DIR / "sleep_log.json"
PROFILE_PATH = DATA_DIR / "user_profile.json"


def _load_sleep_log() -> list:
    """Load sleep log from JSON file."""
    try:
        return json.loads(SLEEP_LOG_PATH.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return []


def _save_sleep_log(log: list):
    """Save sleep log to JSON file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    SLEEP_LOG_PATH.write_text(json.dumps(log, indent=2))


def _get_sleep_target_hours() -> float:
    """Get user's sleep target from profile, default 7.5 hours."""
    try:
        profile = json.loads(PROFILE_PATH.read_text())
        return float(profile.get("sleep_target_hours", 7.5))
    except (FileNotFoundError, json.JSONDecodeError):
        return 7.5


def log_sleep(bedtime: str) -> dict:
    """Log when the user is going to sleep and calculate optimal wake time.

    This function records the bedtime, calculates the recommended wake-up
    time based on the user's sleep target preference, and returns the
    alarm time that should be scheduled.

    Args:
        bedtime: The time the user is going to sleep (e.g., "11:30 PM",
                 "23:30", "11 PM"). Accepts various time formats.

    Returns:
        Dictionary with bedtime, calculated wake time, sleep duration,
        and alarm scheduling info.
    """
    # Parse bedtime
    now = datetime.now()
    parsed_time = None

    formats = ["%I:%M %p", "%I:%M%p", "%I %p", "%I%p", "%H:%M", "%H%M"]
    for fmt in formats:
        try:
            parsed_time = datetime.strptime(bedtime.strip().upper(), fmt)
            break
        except ValueError:
            continue

    if not parsed_time:
        return {"error": f"Could not parse bedtime: '{bedtime}'. Use formats like '11:30 PM' or '23:30'."}

    # Set the bedtime to today (or tomorrow if time has passed)
    bedtime_dt = now.replace(
        hour=parsed_time.hour,
        minute=parsed_time.minute,
        second=0,
        microsecond=0,
    )

    # Calculate wake time
    sleep_target = _get_sleep_target_hours()
    wake_time = bedtime_dt + timedelta(hours=sleep_target)

    # Log to file
    log = _load_sleep_log()
    entry = {
        "date": now.strftime("%Y-%m-%d"),
        "bedtime": bedtime_dt.strftime("%Y-%m-%d %H:%M"),
        "wake_time": wake_time.strftime("%Y-%m-%d %H:%M"),
        "sleep_target_hours": sleep_target,
        "logged_at": now.isoformat(),
    }
    log.append(entry)
    _save_sleep_log(log)

    return {
        "bedtime": bedtime_dt.strftime("%I:%M %p"),
        "wake_time": wake_time.strftime("%I:%M %p"),
        "wake_time_iso": wake_time.isoformat(),
        "sleep_duration_hours": sleep_target,
        "alarm_hour": wake_time.hour,
        "alarm_minute": wake_time.minute,
        "message": (
            f"Sleep logged! Bedtime: {bedtime_dt.strftime('%I:%M %p')}. "
            f"Wake-up alarm set for {wake_time.strftime('%I:%M %p')} "
            f"({sleep_target}h sleep). Good night! 🌙"
        ),
    }


def get_sleep_history(days: int = 7) -> dict:
    """Get sleep history for the past N days.

    Args:
        days: Number of days to look back. Default is 7.

    Returns:
        Dictionary with sleep entries and average sleep duration.
    """
    log = _load_sleep_log()

    cutoff = datetime.now() - timedelta(days=days)
    recent = []
    for entry in log:
        try:
            entry_date = datetime.fromisoformat(entry["logged_at"])
            if entry_date >= cutoff:
                recent.append(entry)
        except (ValueError, KeyError):
            continue

    avg_sleep = 0
    if recent:
        avg_sleep = sum(e.get("sleep_target_hours", 7.5) for e in recent) / len(recent)

    return {
        "entries": recent,
        "count": len(recent),
        "average_sleep_hours": round(avg_sleep, 1),
        "days_covered": days,
        "summary": (
            f"Last {days} days: {len(recent)} entries, "
            f"average {round(avg_sleep, 1)}h sleep per night."
        ),
    }


def cancel_alarm() -> dict:
    """Cancel the next scheduled morning alarm.

    Returns:
        Confirmation that the alarm cancellation was requested.
        The actual scheduler cancellation is handled by server.py.
    """
    return {
        "action": "cancel_alarm",
        "message": "Alarm cancellation requested. The morning alarm will be cancelled.",
    }
