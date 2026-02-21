"""Per-user Google API clients: Gmail, Calendar, Tasks.

Loads OAuth tokens from DB (no Google ADK). Builds Credentials and services per user_id.
"""

from datetime import datetime, timedelta
from pathlib import Path

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
