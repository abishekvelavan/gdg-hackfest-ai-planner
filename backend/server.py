"""Day Planner Backend Server.

FastAPI server wrapping the ADK agent system.
Includes APScheduler for morning alarm cron jobs and
Firebase Cloud Messaging for push notifications.
"""

import os
import json
import asyncio
from datetime import datetime
from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.date import DateTrigger

# Load environment variables
load_dotenv(Path(__file__).parent / "day_planner" / ".env")

# Firebase Admin SDK
import firebase_admin
from firebase_admin import credentials as fb_credentials, messaging

# ADK imports
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.genai import types

# Import the agent
from day_planner.agent import root_agent


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

# --- ADK Runner ---
session_service = InMemorySessionService()
runner = Runner(
    agent=root_agent,
    app_name="day_planner",
    session_service=session_service,
)


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


async def run_agent(user_id: str, message: str, session_id: str = "") -> tuple[str, str]:
    """Run the ADK agent with a message and return the response."""
    if not session_id:
        session = await session_service.create_session(
            app_name="day_planner",
            user_id=user_id,
        )
        session_id = session.id
    else:
        # Verify session exists, create if not
        try:
            await session_service.get_session(
                app_name="day_planner",
                user_id=user_id,
                session_id=session_id,
            )
        except Exception:
            session = await session_service.create_session(
                app_name="day_planner",
                user_id=user_id,
            )
            session_id = session.id

    content = types.Content(
        role="user",
        parts=[types.Part.from_text(message)],
    )

    response_text = ""
    async for event in runner.run_async(
        user_id=user_id,
        session_id=session_id,
        new_message=content,
    ):
        if event.is_final_response() and event.content and event.content.parts:
            response_text = event.content.parts[0].text or ""

    return response_text, session_id


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
@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start scheduler on startup, shut down on exit."""
    scheduler.start()
    print("[SERVER] Scheduler started")
    yield
    scheduler.shutdown()
    print("[SERVER] Scheduler stopped")


# --- FastAPI App ---
app = FastAPI(
    title="Day Planner API",
    description="Agentic Day Planner powered by Google ADK + Gemini 3.0 Flash",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
        "model": "gemini-3.0-flash",
        "scheduler_running": scheduler.running,
        "firebase_configured": firebase_app is not None,
    }


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
    uvicorn.run(app, host="0.0.0.0", port=8000)
