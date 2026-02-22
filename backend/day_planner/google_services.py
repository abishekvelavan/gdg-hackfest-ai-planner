"""Per-user Google API clients: Gmail, Calendar, Tasks.

Loads OAuth tokens from DB (no Google ADK). Builds Credentials and services per user_id.
"""

import os
import re
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

# Import DB after server has set up path so db.get_db works
def _get_tokens(user_id: str) -> dict | None:
    from db import get_google_tokens
    return get_google_tokens(user_id)


def _credentials_from_tokens(user_id: str) -> Credentials | None:
    """Build Credentials for user; refresh if expired. Returns None if not connected."""
    tokens = _get_tokens(user_id)
    if not tokens:
        return None
    expiry = None
    if tokens.get("expiry"):
        try:
            parsed = datetime.fromisoformat(tokens["expiry"].replace("Z", "+00:00"))
            # Credentials.expired compares expiry to naive UTC time; keep expiry naive UTC to avoid comparison error
            expiry = parsed.replace(tzinfo=None) if parsed.tzinfo else parsed
        except (ValueError, TypeError):
            pass
    creds = Credentials(
        token=tokens.get("token"),
        refresh_token=tokens.get("refresh_token"),
        token_uri=tokens.get("token_uri"),
        client_id=tokens.get("client_id"),
        client_secret=tokens.get("client_secret"),
        scopes=tokens.get("scopes"),
        expiry=expiry,
    )
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        # Persist new token
        from db import save_google_tokens
        save_google_tokens(user_id, {
            **tokens,
            "token": creds.token,
            "expiry": creds.expiry.isoformat() if creds.expiry else None,
        })
    return creds


def get_gmail_service(user_id: str):
    """Return Gmail API service for user, or None if not connected."""
    creds = _credentials_from_tokens(user_id)
    if not creds:
        return None
    return build("gmail", "v1", credentials=creds)


def get_calendar_service(user_id: str):
    """Return Calendar API service for user, or None if not connected."""
    creds = _credentials_from_tokens(user_id)
    if not creds:
        return None
    return build("calendar", "v3", credentials=creds)


def get_tasks_service(user_id: str):
    """Return Google Tasks API service for user, or None if not connected."""
    creds = _credentials_from_tokens(user_id)
    if not creds:
        return None
    return build("tasks", "v1", credentials=creds)


# --- Fetch helpers (for post-connect sync / LangGraph use) ---

def fetch_gmail_summary(user_id: str, max_emails: int = 10) -> dict:
    """Fetch brief Gmail summary for user. Returns dict with emails or error."""
    service = get_gmail_service(user_id)
    if not service:
        return {"error": "Google not connected", "emails": []}
    try:
        results = service.users().messages().list(
            userId="me", q="is:unread category:primary", maxResults=max_emails
        ).execute()
        messages = results.get("messages", [])
        emails = []
        for msg in messages[:max_emails]:
            msg_data = service.users().messages().get(
                userId="me", id=msg["id"], format="metadata",
                metadataHeaders=["Subject", "From", "Date"],
            ).execute()
            headers = {h["name"]: h["value"] for h in msg_data.get("payload", {}).get("headers", [])}
            emails.append({
                "subject": headers.get("Subject", "No subject"),
                "from": headers.get("From", ""),
                "date": headers.get("Date", ""),
                "snippet": (msg_data.get("snippet") or "")[:200],
            })
        return {"emails": emails, "count": len(emails)}
    except Exception as e:
        return {"error": str(e), "emails": []}


def fetch_calendar_events(user_id: str, days_ahead: int = 1) -> dict:
    """Fetch primary calendar events for today and next days_ahead days."""
    service = get_calendar_service(user_id)
    if not service:
        return {"error": "Google not connected", "events": []}
    try:
        time_min = datetime.utcnow().isoformat() + "Z"
        time_max = (datetime.utcnow() + timedelta(days=days_ahead)).isoformat() + "Z"
        events_result = service.events().list(
            calendarId="primary",
            timeMin=time_min,
            timeMax=time_max,
            singleEvents=True,
            orderBy="startTime",
        ).execute()
        events = events_result.get("items", [])
        out = []
        for e in events:
            start = e.get("start", {}) or {}
            out.append({
                "summary": e.get("summary", "No title"),
                "start": start.get("dateTime") or start.get("date"),
                "end": (e.get("end") or {}).get("dateTime") or (e.get("end") or {}).get("date"),
                "id": e.get("id"),
            })
        return {"events": out, "count": len(out)}
    except Exception as e:
        return {"error": str(e), "events": []}


# Timezone for calendar events (e.g. IST). Use env CALENDAR_TIMEZONE or default Asia/Kolkata.
CALENDAR_TIMEZONE = os.getenv("CALENDAR_TIMEZONE", "Asia/Kolkata")


def create_calendar_events_from_plan(
    user_id: str,
    events: list[dict],
    reminder_minutes: int = 15,
    date_str: str | None = None,
) -> dict:
    """
    Create Google Calendar events from a day plan. Each event gets a reminder `reminder_minutes` before.
    events: list of {"time": "9:00 AM", "title": "...", "location": "" (optional)}
    date_str: "YYYY-MM-DD" for the day; defaults to today in CALENDAR_TIMEZONE (e.g. IST).
    """
    service = get_calendar_service(user_id)
    if not service:
        return {"error": "Google not connected", "created": 0, "ids": []}

    try:
        tz = ZoneInfo(CALENDAR_TIMEZONE)
    except Exception:
        tz = ZoneInfo("Asia/Kolkata")

    if not date_str:
        now_local = datetime.now(tz)
        date_str = now_local.strftime("%Y-%m-%d")

    created_ids = []
    for ev in events:
        time_str = (ev.get("time") or "").strip()
        title = (ev.get("title") or "Event").strip()
        location = (ev.get("location") or "").strip()
        if not time_str or not title:
            continue

        # Parse "9:00 AM" / "7:00 PM" / "14:30" into hour, minute (handle "00 PM" in second part)
        hour, minute = 9, 0
        try:
            parts = time_str.replace(".", ":").split(":")
            hour = int(parts[0].strip())
            if len(parts) > 1:
                last = (parts[-1] or "").strip().upper()
                # Minute may be "00" or "00 AM" or "30 PM" – take leading digits only
                min_match = re.match(r"^(\d{1,2})", last)
                minute = int(min_match.group(1)) if min_match else 0
                if "PM" in last and hour < 12:
                    hour += 12
                elif "AM" in last and hour == 12:
                    hour = 0
            else:
                minute = 0
        except (ValueError, IndexError, AttributeError):
            pass

        start_dt = datetime.strptime(date_str, "%Y-%m-%d").replace(
            hour=hour, minute=minute, second=0, microsecond=0
        )
        end_dt = start_dt + timedelta(minutes=30)

        start_iso = start_dt.strftime("%Y-%m-%dT%H:%M:%S")
        end_iso = end_dt.strftime("%Y-%m-%dT%H:%M:%S")

        body = {
            "summary": title,
            "location": location or None,
            "start": {"dateTime": start_iso, "timeZone": CALENDAR_TIMEZONE},
            "end": {"dateTime": end_iso, "timeZone": CALENDAR_TIMEZONE},
            "reminders": {
                "useDefault": False,
                "overrides": [{"method": "popup", "minutes": reminder_minutes}],
            },
        }
        try:
            created = service.events().insert(
                calendarId="primary",
                body=body,
            ).execute()
            created_ids.append(created.get("id", ""))
        except Exception as e:
            return {
                "error": str(e),
                "created": len(created_ids),
                "ids": created_ids,
            }
    return {"created": len(created_ids), "ids": created_ids}


def fetch_google_tasks(user_id: str, max_lists: int = 5) -> dict:
    """Fetch task lists and their tasks for user."""
    service = get_tasks_service(user_id)
    if not service:
        return {"error": "Google not connected", "task_lists": []}
    try:
        list_result = service.tasklists().list(maxResults=max_lists).execute()
        task_lists = list_result.get("items", [])
        result = []
        for tl in task_lists:
            list_id = tl.get("id")
            title = tl.get("title", "Tasks")
            tasks_result = service.tasks().list(tasklist=list_id, showCompleted=False).execute()
            tasks = tasks_result.get("items", [])
            result.append({
                "list_title": title,
                "list_id": list_id,
                "tasks": [
                    {"title": t.get("title"), "due": t.get("due"), "id": t.get("id")}
                    for t in tasks[:20]
                ],
            })
        return {"task_lists": result}
    except Exception as e:
        return {"error": str(e), "task_lists": []}
