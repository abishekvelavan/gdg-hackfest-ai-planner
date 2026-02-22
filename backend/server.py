"""Day Planner Backend Server.

FastAPI server with LangGraph + Gemini agent (no Google ADK).
Includes APScheduler for morning alarm cron jobs and
Firebase Cloud Messaging for push notifications.
"""

import os
import json
import asyncio
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger

# Load environment variables
load_dotenv(Path(__file__).parent / "day_planner" / ".env")

# Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials as fb_credentials, messaging

# LangGraph + Gemini agent (no ADK)
from day_planner.agent import run_chat

# MongoDB
from db import get_db, save_profile, get_profile, close_db, register_user, login_user, save_google_tokens, get_google_tokens


# --- Config ---
DATA_DIR = Path(__file__).parent / "day_planner" / "data"
FIREBASE_CONFIG_PATH = Path(__file__).parent / "firebase_config.json"
FCM_TOKENS_PATH = DATA_DIR / "fcm_tokens.json"

# --- Scheduler ---
scheduler = AsyncIOScheduler()

# --- Firebase Init ---
firebase_app = None
if FIREBASE_CONFIG_PATH.exists():
    cred = fb_credentials.Certificate(str(FIREBASE_CONFIG_PATH))
    firebase_app = firebase_admin.initialize_app(cred)


# --- Pydantic Models ---
class ChatRequest(BaseModel):
    message: str
    user_id: str = "default_user"
    session_id: str = ""


class ChatResponse(BaseModel):
    response: str
    session_id: str


class SleepRequest(BaseModel):
    bedtime: str
    user_id: str = "default_user"


class FCMTokenRequest(BaseModel):
    token: str
    user_id: str = "default_user"


class NotificationRequest(BaseModel):
    title: str
    body: str
    user_id: str = "default_user"


class ProfileRequest(BaseModel):
    user_id: str = "default_user"
    name: str = ""
    home_address: str = ""
    office_address: str = ""
    work_hours: str = ""
    energy_type: str = ""
    peak_focus_hours: str = ""
    transport: list[str] = []
    exercise: list[dict] = []
    bedtime: str = ""
    wake_time: str = ""
    hobbies: list[dict] = []
    goals: list[str] = []


class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class GoogleTokensFromClientRequest(BaseModel):
    """Tokens obtained by the app from client-side Google OAuth (e.g. Expo AuthSession)."""
    user_id: str = "default_user"
    access_token: str
    refresh_token: str = ""
    expiry: str | None = None


# --- Lifespan ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start scheduler on startup, shut down on exit."""
    scheduler.start()
    # Connect to MongoDB
    get_db()
    print("[SERVER] Scheduler started, MongoDB connected")
    yield
    scheduler.shutdown()
    close_db()
    print("[SERVER] Scheduler stopped, MongoDB disconnected")


# --- FastAPI App ---
app = FastAPI(
    title="Day Planner API",
    description="Agentic Day Planner powered by LangGraph + Gemini",
    version="1.0.0",
    lifespan=lifespan,
)

# Allow all origins for dev; tighten for production
CORS_ORIGINS = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=False,  # Cannot use credentials with wildcard origin
    allow_methods=["*"],
    allow_headers=["*"],
)


def _cors_headers(origin: str | None) -> dict:
    """Headers so browser accepts response when request came from any origin."""
    return {"Access-Control-Allow-Origin": origin or "*"}


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    """Ensure 500 responses include CORS headers so the client sees the error."""
    import traceback
    traceback.print_exc()
    origin = request.headers.get("origin")
    headers = _cors_headers(origin)
    return JSONResponse(
        status_code=500,
        content={"detail": str(exc), "type": type(exc).__name__},
        headers=headers,
    )


# --- Auth Endpoints ---
@app.post("/api/register")
async def register(req: RegisterRequest):
    """Register a new user with email/password."""
    try:
        user = register_user(req.email, req.password, req.name)
        return {"status": "ok", "user": user}
    except ValueError as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=400, content={"status": "error", "message": str(e)})


@app.post("/api/login")
async def login(req: LoginRequest):
    """Login with email/password."""
    try:
        user = login_user(req.email, req.password)
        return {"status": "ok", "user": user}
    except ValueError as e:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=401, content={"status": "error", "message": str(e)})


# --- Helper Functions ---
def _load_fcm_tokens() -> dict:
    """Load FCM tokens from file."""
    try:
        return json.loads(FCM_TOKENS_PATH.read_text())
    except (FileNotFoundError, json.JSONDecodeError):
        return {}


def _save_fcm_tokens(tokens: dict):
    """Save FCM tokens to file."""
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    FCM_TOKENS_PATH.write_text(json.dumps(tokens, indent=2))


def send_push_notification(user_id: str, title: str, body: str, data: dict = None):
    """Send a push notification to a user via FCM."""
    if not firebase_app:
        print(f"[FCM] Firebase not configured. Would send: {title} - {body}")
        return False

    tokens = _load_fcm_tokens()
    token = tokens.get(user_id)
    if not token:
        print(f"[FCM] No token for user {user_id}")
        return False

    try:
        message = messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data=data or {},
            token=token,
        )
        messaging.send(message)
        print(f"[FCM] Sent: {title} to {user_id}")
        return True
    except Exception as e:
        print(f"[FCM] Error: {e}")
        return False


def _load_user_context(user_id: str) -> tuple[dict | None, dict | None]:
    """Load profile from DB and build Google data from stored profile (or fetch live if not stored)."""
    profile = get_profile(user_id)

    # Prefer Google data stored in profile (from last sync); else fetch live if connected
    google_data = None
    if profile and (profile.get("google_gmail") is not None or profile.get("google_calendar") is not None or profile.get("google_tasks") is not None):
        google_data = {
            "gmail": profile.get("google_gmail") or {},
            "calendar": profile.get("google_calendar") or {},
            "tasks": profile.get("google_tasks") or {},
        }
    elif get_google_tokens(user_id):
        try:
            from day_planner.google_services import (
                fetch_gmail_summary,
                fetch_calendar_events,
                fetch_google_tasks,
            )
            google_data = {
                "gmail": fetch_gmail_summary(user_id, max_emails=10),
                "calendar": fetch_calendar_events(user_id, days_ahead=2),
                "tasks": fetch_google_tasks(user_id, max_lists=5),
            }
        except Exception as e:
            print(f"[SERVER] Google data fetch failed for {user_id}: {e}")
            google_data = {}

    return (profile, google_data)


async def run_agent(user_id: str, message: str, session_id: str = "") -> tuple[str, str]:
    """Run the LangGraph + Gemini agent with profile + Google context; returns (response_text, session_id)."""
    profile, google_data = _load_user_context(user_id)
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(
        None,
        lambda: run_chat(
            user_id=user_id,
            message=message,
            session_id=session_id or "",
            profile=profile,
            google_data=google_data,
        ),
    )


async def trigger_morning_plan(user_id: str):
    """Triggered by scheduler at wake time. Generates day plan + sends FCM."""
    print(f"[SCHEDULER] Morning alarm triggered for {user_id} at {datetime.now()}")

    # Generate affirmation + day plan
    prompt = (
        "It's morning! The user just woke up. "
        "Start with a warm, personalized positive affirmation about their sleep and the day ahead. "
        "Then create their full day plan by checking calendar, gmail, notion, weather, and maps. "
        "Be upbeat and encouraging!"
    )

    response, _ = await run_agent(user_id, prompt)

    # Send push notification with affirmation
    send_push_notification(
        user_id=user_id,
        title="🌅 Good Morning!",
        body="Your day plan is ready. Tap to see your schedule!",
        data={"type": "morning_plan", "plan": response[:500]},
    )

    print(f"[SCHEDULER] Morning plan sent to {user_id}")


# --- Lifespan ---


# --- API Routes ---

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    """Send a message to the Day Planner agent."""
    try:
        response, session_id = await run_agent(
            user_id=request.user_id,
            message=request.message,
            session_id=request.session_id,
        )

        # Check if the response contains sleep/alarm data
        if "alarm" in response.lower() and "wake" in response.lower():
            # Extract alarm info and schedule it
            await _schedule_alarm_from_response(request.user_id, response)

        return ChatResponse(response=response, session_id=session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/sleep")
async def log_sleep_and_schedule(request: SleepRequest):
    """Log bedtime and schedule morning alarm."""
    # Run through the agent for natural response
    response, session_id = await run_agent(
        user_id=request.user_id,
        message=f"I'm going to sleep at {request.bedtime}",
    )

    # Parse the sleep log to get wake time and schedule alarm
    from day_planner.tools.sleep_tools import _load_sleep_log
    log = _load_sleep_log()
    if log:
        latest = log[-1]
        wake_time = datetime.fromisoformat(latest["wake_time_iso"] if "wake_time_iso" in latest else latest["wake_time"])

        # Schedule the morning alarm
        job_id = f"morning_alarm_{request.user_id}"

        # Remove existing alarm if any
        existing = scheduler.get_job(job_id)
        if existing:
            scheduler.remove_job(job_id)

        scheduler.add_job(
            trigger_morning_plan,
            trigger=DateTrigger(run_date=wake_time),
            args=[request.user_id],
            id=job_id,
            replace_existing=True,
        )

        # Send confirmation notification
        send_push_notification(
            user_id=request.user_id,
            title="😴 Good Night!",
            body=f"Alarm set for {wake_time.strftime('%I:%M %p')}. Sleep well!",
            data={"type": "sleep_logged", "wake_time": wake_time.isoformat()},
        )

        return {
            "response": response,
            "wake_time": wake_time.isoformat(),
            "alarm_scheduled": True,
            "session_id": session_id,
        }

    return {"response": response, "alarm_scheduled": False, "session_id": session_id}


@app.post("/api/morning-plan")
async def morning_plan_trigger(user_id: str = "default_user"):
    """Manually trigger or Cloud Scheduler trigger for morning plan."""
    await trigger_morning_plan(user_id)
    return {"status": "morning_plan_triggered", "user_id": user_id}


@app.post("/api/fcm-token")
async def register_fcm_token(request: FCMTokenRequest):
    """Register a device's FCM token for push notifications."""
    tokens = _load_fcm_tokens()
    tokens[request.user_id] = request.token
    _save_fcm_tokens(tokens)
    return {"status": "token_registered", "user_id": request.user_id}


@app.post("/api/notify")
async def send_notification(request: NotificationRequest):
    """Send a push notification to a user (for testing)."""
    success = send_push_notification(
        user_id=request.user_id,
        title=request.title,
        body=request.body,
    )
    return {"status": "sent" if success else "failed"}


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "agent": "day_planner",
        "model": "langgraph+gemini-2.0-flash",
        "scheduler_running": scheduler.running,
        "firebase_configured": firebase_app is not None,
        "db_connected": get_db() is not None,
    }


@app.post("/api/profile")
async def save_user_profile(request: ProfileRequest):
    """Save or update a user profile to MongoDB."""
    try:
        profile_data = request.model_dump(exclude={"user_id"})
        saved = save_profile(request.user_id, profile_data)
        return {"status": "saved", "profile": saved}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save profile: {str(e)}")


@app.get("/api/profile/{user_id}")
async def get_user_profile(user_id: str):
    """Get a user profile from MongoDB."""
    profile = get_profile(user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


# --- Google OAuth (Gmail, Calendar, Tasks) — no Google ADK ---
# Redirect URI must match Google Cloud Console (e.g. https://your-api.com/api/google/callback)
BACKEND_URL = os.getenv("BACKEND_URL", "http://localhost:8000").rstrip("/")
GOOGLE_CALLBACK_PATH = "/api/google/callback"


@app.get("/api/google/auth")
async def google_auth_url(user_id: str = Query(..., description="User ID to associate with tokens")):
    """Return Google OAuth consent URL. Uses GOOGLE_CLIENT_ID from env (no credentials.json required)."""
    try:
        from day_planner.google_oauth import build_auth_url
        redirect_uri = f"{BACKEND_URL}{GOOGLE_CALLBACK_PATH}"
        auth_url = build_auth_url(user_id, redirect_uri)
        return {"auth_url": auth_url, "redirect_uri": redirect_uri}
    except FileNotFoundError as e:
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/api/google/tokens")
async def google_tokens_from_client(request: GoogleTokensFromClientRequest):
    """
    Store Google tokens that the app obtained (e.g. from client-side OAuth / Expo AuthSession).
    No credentials.json needed: set GOOGLE_CLIENT_ID (and optionally GOOGLE_CLIENT_SECRET) in env for refresh.
    """
    try:
        from day_planner.google_oauth import save_tokens_from_client
        token_dict = save_tokens_from_client(
            request.user_id,
            request.access_token,
            request.refresh_token,
            request.expiry,
        )
        save_google_tokens(request.user_id, token_dict)
        return {"status": "ok", "message": "Google tokens saved. Gmail, Calendar, and Tasks are connected."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/api/google/callback", response_class=HTMLResponse)
async def google_oauth_callback(
    code: str = Query(None),
    state: str = Query(None, description="user_id"),
    error: str = Query(None),
):
    """Exchange code for tokens and store by user_id. Show success or error page."""
    if error:
        return _google_callback_html(success=False, message=f"Google denied access: {error}")
    if not code or not state:
        return _google_callback_html(success=False, message="Missing code or state (user_id).")
    try:
        from day_planner.google_oauth import exchange_code_for_tokens
        redirect_uri = f"{BACKEND_URL}{GOOGLE_CALLBACK_PATH}"
        user_id, token_dict = exchange_code_for_tokens(code, redirect_uri, state)
        save_google_tokens(user_id, token_dict)
        return _google_callback_html(success=True, message="Gmail, Calendar, and Tasks are now connected.")
    except Exception as e:
        return _google_callback_html(success=False, message=str(e))


def _google_callback_html(success: bool, message: str) -> HTMLResponse:
    html = f"""
    <!DOCTYPE html>
    <html><head><meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Google Connect</title></head>
    <body style="font-family:sans-serif;max-width:360px;margin:40px auto;padding:24px;text-align:center;">
    <h2>{"✓ Connected" if success else "Connection failed"}</h2>
    <p>{message}</p>
    <p style="color:#666;">You can close this window and return to the app.</p>
    </body></html>
    """
    return HTMLResponse(content=html)


@app.get("/api/google/status")
async def google_connection_status(user_id: str = Query(..., description="User ID")):
    """Check if user has connected their Google account (Gmail, Calendar, Tasks)."""
    tokens = get_google_tokens(user_id)
    return {"connected": tokens is not None}


@app.get("/api/google/sync")
async def google_sync(
    user_id: str = Query(..., description="User ID"),
):
    """After profile is stored and Google is connected, fetch Gmail, Calendar, and Google Tasks (LangGraph or direct; no ADK)."""
    try:
        tokens = get_google_tokens(user_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        return JSONResponse(
            status_code=200,
            content={
                "gmail": {"error": str(e), "emails": []},
                "calendar": {"error": str(e), "events": []},
                "tasks": {"error": str(e), "task_lists": []},
                "sync_error": "Database error",
            },
        )
    if not tokens:
        raise HTTPException(status_code=400, detail="Google not connected. Complete OAuth first.")
    result = None
    try:
        from day_planner.google_sync_graph import run_google_sync
        result = run_google_sync(user_id)
    except Exception as e:
        import traceback
        traceback.print_exc()
        try:
            from day_planner.google_services import fetch_gmail_summary, fetch_calendar_events, fetch_google_tasks
            result = {
                "gmail": fetch_gmail_summary(user_id, max_emails=10),
                "calendar": fetch_calendar_events(user_id, days_ahead=2),
                "tasks": fetch_google_tasks(user_id, max_lists=5),
            }
        except Exception as e2:
            traceback.print_exc()
            result = {
                "gmail": {"error": str(e2), "emails": []},
                "calendar": {"error": str(e2), "events": []},
                "tasks": {"error": str(e2), "task_lists": []},
                "sync_error": str(e),
            }
    # Persist synced data into the profile so the agent can use it for day planning
    if result and "sync_error" not in result:
        save_profile(user_id, {
            "google_gmail": result.get("gmail") or {},
            "google_calendar": result.get("calendar") or {},
            "google_tasks": result.get("tasks") or {},
            "google_synced_at": datetime.utcnow().isoformat(),
        })
    return result


async def _schedule_alarm_from_response(user_id: str, response: str):
    """Try to extract alarm time from agent response and schedule it."""
    from day_planner.tools.sleep_tools import _load_sleep_log
    log = _load_sleep_log()
    if log:
        latest = log[-1]
        if "wake_time" in latest:
            try:
                wake_time = datetime.fromisoformat(latest["wake_time"])
                if wake_time > datetime.now():
                    job_id = f"morning_alarm_{user_id}"
                    existing = scheduler.get_job(job_id)
                    if existing:
                        scheduler.remove_job(job_id)

                    scheduler.add_job(
                        trigger_morning_plan,
                        trigger=DateTrigger(run_date=wake_time),
                        args=[user_id],
                        id=job_id,
                        replace_existing=True,
                    )
                    print(f"[SCHEDULER] Alarm set for {user_id} at {wake_time}")
            except (ValueError, KeyError):
                pass


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
