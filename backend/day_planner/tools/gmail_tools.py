"""Gmail tools for the Day Planner agent.

Scans the user's Gmail inbox for actionable items — deadlines,
travel confirmations, meeting invites, and action items.
Uses Gmail API with OAuth2 (shared credentials with Calendar).
"""

import os
import json
import base64
from datetime import datetime, timedelta
from pathlib import Path
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build

SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
]
TOKEN_PATH = Path(__file__).parent.parent.parent / "token.json"
CREDENTIALS_PATH = Path(__file__).parent.parent.parent / "credentials.json"


def _get_gmail_service():
    """Authenticate and return Gmail API service."""
    creds = None

    if TOKEN_PATH.exists():
        creds = Credentials.from_authorized_user_file(str(TOKEN_PATH), SCOPES)

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            if not CREDENTIALS_PATH.exists():
                return None
            flow = InstalledAppFlow.from_client_secrets_file(
                str(CREDENTIALS_PATH), SCOPES
            )
            creds = flow.run_local_server(port=0)

        TOKEN_PATH.write_text(creds.to_json())

    return build("gmail", "v1", credentials=creds)


def scan_inbox_for_actionables(hours: int = 24) -> dict:
    """Scan recent emails for deadlines, travel confirmations, and action items.

    Args:
        hours: Number of hours to look back. Default is 24.

    Returns:
        Dictionary with categorized actionable items from the inbox.
    """
    service = _get_gmail_service()
    if not service:
        return {"error": "Gmail not authenticated. Run OAuth setup first."}

    try:
        after_date = (datetime.now() - timedelta(hours=hours)).strftime("%Y/%m/%d")
        query = f"after:{after_date} is:unread"

        results = service.users().messages().list(
            userId="me", q=query, maxResults=20
        ).execute()

        messages = results.get("messages", [])
        actionables = {
            "deadlines": [],
            "travel_confirmations": [],
            "meeting_invites": [],
            "action_items": [],
            "total_unread": len(messages),
        }

        deadline_keywords = ["deadline", "due by", "due date", "submit by", "due tomorrow", "expires"]
        travel_keywords = ["booking confirmation", "flight", "hotel", "train", "itinerary", "reservation"]
        meeting_keywords = ["invitation", "invite", "meeting", "calendar event", "rsvp"]
        action_keywords = ["please review", "action required", "sign and return", "respond by", "urgent"]

        for msg in messages[:15]:
            msg_data = service.users().messages().get(
                userId="me", id=msg["id"], format="metadata",
                metadataHeaders=["Subject", "From", "Date"]
            ).execute()

            headers = {h["name"]: h["value"] for h in msg_data.get("payload", {}).get("headers", [])}
            subject = headers.get("Subject", "").lower()
            sender = headers.get("From", "")
            snippet = msg_data.get("snippet", "").lower()
            combined = f"{subject} {snippet}"

            item = {
                "subject": headers.get("Subject", "No subject"),
                "from": sender,
                "snippet": msg_data.get("snippet", "")[:150],
            }

            if any(kw in combined for kw in deadline_keywords):
                actionables["deadlines"].append(item)
            elif any(kw in combined for kw in travel_keywords):
                actionables["travel_confirmations"].append(item)
            elif any(kw in combined for kw in meeting_keywords):
                actionables["meeting_invites"].append(item)
            elif any(kw in combined for kw in action_keywords):
                actionables["action_items"].append(item)

        actionables["summary"] = (
            f"Found {len(actionables['deadlines'])} deadlines, "
            f"{len(actionables['travel_confirmations'])} travel confirmations, "
            f"{len(actionables['meeting_invites'])} meeting invites, "
            f"{len(actionables['action_items'])} action items "
            f"in {actionables['total_unread']} unread emails."
        )

        return actionables
    except Exception as e:
        return {"error": f"Gmail scan error: {str(e)}"}


def get_email_summary(max_emails: int = 10) -> dict:
    """Get a summary of recent important unread emails.

    Args:
        max_emails: Maximum number of emails to summarize.

    Returns:
        Dictionary with a list of email summaries (subject, from, snippet).
    """
    service = _get_gmail_service()
    if not service:
        return {"error": "Gmail not authenticated. Run OAuth setup first."}

    try:
        results = service.users().messages().list(
            userId="me", q="is:unread category:primary", maxResults=max_emails
        ).execute()

        messages = results.get("messages", [])
        emails = []

        for msg in messages:
            msg_data = service.users().messages().get(
                userId="me", id=msg["id"], format="metadata",
                metadataHeaders=["Subject", "From", "Date"]
            ).execute()

            headers = {h["name"]: h["value"] for h in msg_data.get("payload", {}).get("headers", [])}
            emails.append({
                "subject": headers.get("Subject", "No subject"),
                "from": headers.get("From", "Unknown"),
                "date": headers.get("Date", ""),
                "snippet": msg_data.get("snippet", "")[:200],
            })

        return {
            "emails": emails,
            "count": len(emails),
            "summary": f"{len(emails)} unread emails in primary inbox.",
        }
    except Exception as e:
        return {"error": f"Email summary error: {str(e)}"}
