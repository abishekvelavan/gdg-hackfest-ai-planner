"""Google OAuth2 for per-user Gmail, Calendar, and Tasks.

Supports two modes (no credentials.json required):
1. Client ID only: set GOOGLE_CLIENT_ID (and optionally GOOGLE_CLIENT_SECRET) in env.
   Create an "Desktop app" or "Web application" OAuth client in Google Cloud Console;
   for Desktop app, client_secret is optional for code exchange.
2. App sends tokens: mobile does OAuth (e.g. Expo AuthSession), then POST /api/google/tokens
   with access_token, refresh_token; backend stores and uses them (dynamic user data).
"""

import os
import urllib.parse
from pathlib import Path

# Scopes for Gmail (read), Calendar, and Google Tasks
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/calendar",
    "https://www.googleapis.com/auth/calendar.events",
    "https://www.googleapis.com/auth/tasks",
    "https://www.googleapis.com/auth/tasks.readonly",
]

TOKEN_URI = "https://oauth2.googleapis.com/token"
AUTH_URI = "https://accounts.google.com/o/oauth2/v2/auth"

CREDENTIALS_PATH = Path(__file__).parent.parent / "credentials.json"


def _get_client_id() -> str | None:
    return (os.getenv("GOOGLE_CLIENT_ID") or os.getenv("GOOGLE_OAUTH_CLIENT_ID") or "").strip() or None


def _get_client_secret() -> str | None:
    return (os.getenv("GOOGLE_CLIENT_SECRET") or os.getenv("GOOGLE_OAUTH_CLIENT_SECRET") or "").strip() or None


def _build_auth_url_with_client_id(client_id: str, redirect_uri: str, state: str) -> str:
    """Build consent URL using only client_id (no credentials.json)."""
    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": " ".join(SCOPES),
        "state": state,
        "access_type": "offline",
        "prompt": "consent",
        "include_granted_scopes": "true",
    }
    return f"{AUTH_URI}?{urllib.parse.urlencode(params)}"


def build_auth_url(user_id: str, redirect_uri: str) -> str:
    """
    Build Google OAuth consent URL. state=user_id so callback knows which user.
    Uses GOOGLE_CLIENT_ID from env (no credentials.json required).
    """
    client_id = _get_client_id()
    if client_id:
        return _build_auth_url_with_client_id(client_id, redirect_uri, user_id)

    if not CREDENTIALS_PATH.exists():
        raise FileNotFoundError(
            "Google OAuth not configured. Either set GOOGLE_CLIENT_ID in env (no credentials.json needed), "
            "or place credentials.json in the backend folder. "
            "Create an OAuth 2.0 Client (Desktop app or Web) in Google Cloud Console > APIs & Services > Credentials."
        )

    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_PATH),
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )
    flow.redirect_uri = redirect_uri
    auth_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=user_id,
    )
    return auth_url


def exchange_code_for_tokens(code: str, redirect_uri: str, state: str) -> tuple[str, dict]:
    """
    Exchange authorization code for tokens. Returns (user_id, token_dict).
    Works with GOOGLE_CLIENT_ID only (no credentials.json); client_secret optional for Desktop app.
    """
    client_id = _get_client_id()
    client_secret = _get_client_secret()

    if client_id and not CREDENTIALS_PATH.exists():
        # Exchange using env client_id. For "Web application" client, client_secret is required.
        import requests
        code_clean = (code or "").strip()
        redirect_uri_clean = (redirect_uri or "").strip()
        data = {
            "code": code_clean,
            "client_id": client_id,
            "redirect_uri": redirect_uri_clean,
            "grant_type": "authorization_code",
        }
        # Web application clients require client_secret; Desktop app can omit or use empty.
        if client_secret is not None:
            data["client_secret"] = client_secret
        resp = requests.post(
            TOKEN_URI,
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            timeout=30,
        )
        if not resp.ok:
            err_body = resp.text
            try:
                err_json = resp.json()
                err_body = err_json.get("error_description", err_json.get("error", err_body))
            except Exception:
                pass
            raise ValueError(f"Token exchange failed ({resp.status_code}): {err_body}")
        payload = resp.json()
        token_dict = {
            "token": payload.get("access_token"),
            "refresh_token": payload.get("refresh_token"),
            "token_uri": TOKEN_URI,
            "client_id": client_id,
            "client_secret": client_secret or "",
            "scopes": SCOPES,
            "expiry": None,
        }
        if payload.get("expires_in"):
            from datetime import datetime, timezone, timedelta
            token_dict["expiry"] = (datetime.now(timezone.utc) + timedelta(seconds=payload["expires_in"])).isoformat()
        return (state or "default_user", token_dict)

    if not CREDENTIALS_PATH.exists():
        raise FileNotFoundError("Set GOOGLE_CLIENT_ID in env or add credentials.json to exchange the code.")

    from google_auth_oauthlib.flow import Flow
    flow = Flow.from_client_secrets_file(
        str(CREDENTIALS_PATH),
        scopes=SCOPES,
        redirect_uri=redirect_uri,
    )
    flow.redirect_uri = redirect_uri
    flow.fetch_token(code=code)
    credentials = flow.credentials
    token_dict = {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret or "",
        "scopes": list(credentials.scopes) if credentials.scopes else SCOPES,
        "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
    }
    return (state or "default_user", token_dict)


def save_tokens_from_client(user_id: str, access_token: str, refresh_token: str = "", expiry: str | None = None) -> dict:
    """
    Save tokens that the app obtained (e.g. from client-side OAuth).
    Backend then uses these for Gmail/Calendar/Tasks; no credentials.json needed.
    """
    client_id = _get_client_id()
    client_secret = _get_client_secret()
    token_dict = {
        "token": access_token,
        "refresh_token": refresh_token or "",
        "token_uri": TOKEN_URI,
        "client_id": client_id or "",
        "client_secret": client_secret or "",
        "scopes": SCOPES,
        "expiry": expiry,
    }
    return token_dict
