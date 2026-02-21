"""Day Planner Agent — LangGraph + Gemini LLM (no prompt chain, no Google ADK).

ReAct-style graph: LLM node -> conditional (tool calls -> tools node -> LLM, else END).
Session history kept in memory per session_id.
"""

import os
import secrets
from typing import Annotated, Sequence, TypedDict

from langchain_core.messages import BaseMessage, HumanMessage, AIMessage, SystemMessage, ToolMessage
from langchain_core.tools import tool
from langgraph.graph import StateGraph, END
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from langchain_google_genai import ChatGoogleGenerativeAI

from .tools.weather_tools import (
    get_current_weather as _get_current_weather,
    get_hourly_forecast as _get_hourly_forecast,
    get_travel_advisory as _get_travel_advisory,
)
from .tools.gmail_tools import (
    scan_inbox_for_actionables as _scan_inbox_for_actionables,
    get_email_summary as _get_email_summary,
)
from .tools.sleep_tools import (
    log_sleep as _log_sleep,
    get_sleep_history as _get_sleep_history,
    cancel_alarm as _cancel_alarm,
)
from .tools.profile_tools import (
    is_onboarding_needed as _is_onboarding_needed,
    get_user_profile as _get_user_profile,
    save_user_profile as _save_user_profile,
)
from .tools.maps_tools import (
    get_directions as _get_directions,
    recommend_travel_mode as _recommend_travel_mode,
)


# --- LangChain tools (wrappers so Gemini can call them) ---

@tool
def get_current_weather(city: str = "") -> dict:
    """Get current weather conditions for a city. If city is empty, uses default from env."""
    return _get_current_weather(city=city or None)


@tool
def get_hourly_forecast(city: str = "") -> dict:
    """Get hourly weather forecast for today. If city is empty, uses default from env."""
    return _get_hourly_forecast(city=city or None)


@tool
def get_travel_advisory(city: str = "") -> dict:
    """Get travel advisory: recommend bike, car, or stay in based on weather. If city empty, uses default."""
    return _get_travel_advisory(city=city or None)


@tool
def get_directions(origin: str, destination: str, mode: str = "driving") -> dict:
    """Get travel time and distance between two places (Google Maps). origin and destination are addresses or place names. mode: driving, walking, bicycling, or transit."""
    return _get_directions(origin=origin, destination=destination, mode=mode)


@tool
def recommend_travel_mode(origin: str, destination: str, city: str = "") -> dict:
    """Recommend which vehicle to use (car, bike, walk, transit) with a reason. Uses Google Maps for travel times and weather; returns recommended_mode and a short reason (e.g. why bike vs drive). Call this when planning travel between two locations so you can show the user why you chose that mode."""
    return _recommend_travel_mode(origin=origin, destination=destination, city=city)


@tool
def scan_inbox_for_actionables(hours: int = 24) -> dict:
    """Scan recent emails for deadlines, travel confirmations, meeting invites, action items. hours: lookback (default 24)."""
    return _scan_inbox_for_actionables(hours=hours)


@tool
def get_email_summary(max_emails: int = 10) -> dict:
    """Get a summary of recent important unread emails. max_emails: max to return (default 10)."""
    return _get_email_summary(max_emails=max_emails)


@tool
def log_sleep(bedtime: str) -> dict:
    """Log when the user is going to sleep and get recommended wake time. bedtime: e.g. '11:30 PM' or '23:30'."""
    return _log_sleep(bedtime=bedtime)


@tool
def get_sleep_history(days: int = 7) -> dict:
    """Get sleep history for the past N days. days: number of days (default 7)."""
    return _get_sleep_history(days=days)


@tool
def cancel_alarm() -> dict:
    """Cancel the next scheduled morning alarm."""
    return _cancel_alarm()


@tool
def is_onboarding_needed() -> dict:
    """Check if the user still needs to complete onboarding (profile setup)."""
    return _is_onboarding_needed()


@tool
def get_user_profile() -> dict:
    """Get the current user profile (preferences, work hours, addresses, etc.)."""
    return _get_user_profile()


@tool
def save_user_profile(
    name: str = "",
    work_hours: str = "",
    home_address: str = "",
    office_address: str = "",
    energy_type: str = "",
    peak_focus_hours: str = "",
    sleep_target_hours: float = 7.5,
) -> dict:
    """Save or update user profile. All args optional; only provided fields are updated."""
    return _save_user_profile(
        name=name,
        work_hours=work_hours,
        home_address=home_address,
        office_address=office_address,
        energy_type=energy_type,
        peak_focus_hours=peak_focus_hours,
        sleep_target_hours=sleep_target_hours,
    )


TOOLS = [
    get_current_weather,
    get_hourly_forecast,
    get_travel_advisory,
    get_directions,
    recommend_travel_mode,
    scan_inbox_for_actionables,
    get_email_summary,
    log_sleep,
    get_sleep_history,
    cancel_alarm,
    is_onboarding_needed,
    get_user_profile,
    save_user_profile,
]


SYSTEM_INSTRUCTION = """You are the Day Planner — an intelligent AI assistant that creates optimized daily schedules.

**CRITICAL — Use the context you are given.** At the start of each user message you receive a block with:
- [User profile from app] — name, work_hours, home_address, office_address, energy_type, peak_focus_hours, goals, hobbies, etc.
- [Google Calendar], [Google Tasks], [Gmail] — when the user has connected Google.

**Do NOT ask the user for name, work hours, address, or energy preferences if that information is already in the profile block.** Use it. If something is missing (e.g. no profile at all), then you may ask once for the essentials.

Use your tools when needed:
- **Weather**: get_current_weather, get_hourly_forecast, get_travel_advisory — for transport and outdoor plans.
- **Google Maps**: get_directions(origin, destination, mode) — travel time and distance for driving, walking, bicycling, or transit. recommend_travel_mode(origin, destination, city) — recommends car/bike/walk/transit with a reason (uses Maps + weather). Call this for any trip between two places (e.g. home to office, home to event) so you can show travel time and explain why that vehicle (e.g. "🚲 Bike (15 min) — Pleasant weather; bike recommended for this distance" or "🚗 Drive (12 min) — Rain expected.").
- **Gmail**: scan_inbox_for_actionables, get_email_summary — deadlines, travel, meeting invites, action items.
- **Sleep**: log_sleep, get_sleep_history, cancel_alarm — log bedtime, get wake time, cancel alarm.
- **Profile**: is_onboarding_needed, get_user_profile, save_user_profile — only when you need to read or update something not already in context.

When asked to plan the day: use the profile (name, work hours, addresses, peak focus, goals) and Google data (calendar events, tasks, emails) from the context above. For each segment that involves travel (e.g. home → office, office → venue), call recommend_travel_mode(origin, destination, city) so you get real travel times and a reason for the chosen vehicle. Add weather via tools. Produce a time-blocked schedule with ⏰ time, 📍 location, and travel mode + duration + short reason (e.g. 🚗 12 min — rain expected). Schedule high-priority tasks in peak focus hours; include breaks and travel time. Be personal — e.g. "Good morning, {name}".
When the user says they're going to sleep: call log_sleep with their bedtime, then respond with a warm goodnight and the wake time.
For morning/affirmation: start with a short positive affirmation, then the day plan. Be concise and actionable.

**Output format:** Plain text. For day plans use: ⏰ [Time] - [Activity] 📍 [Location] 🚗 [Travel if relevant]. Do not return JSON or raw message objects — only human-readable text."""


# --- State & Graph ---

class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], add_messages]


def _create_llm():
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    return ChatGoogleGenerativeAI(
        model="gemini-2.5-flash",
        temperature=0.7,
        google_api_key=api_key,
    ).bind_tools(TOOLS)


def _call_model(state: AgentState):
    llm = _create_llm()
    system = SystemMessage(content=SYSTEM_INSTRUCTION)
    messages = [system] + list(state["messages"])
    response = llm.invoke(messages)
    return {"messages": [response]}


def _should_continue(state: AgentState) -> str:
    messages = state["messages"]
    if not messages:
        return "end"
    last = messages[-1]
    if isinstance(last, AIMessage) and getattr(last, "tool_calls", None):
        return "continue"
    return "end"


# Lazy-compiled graph (so we don't need API key at import time)
_graph = None


def _get_graph():
    global _graph
    if _graph is None:
        workflow = StateGraph(AgentState)
        workflow.add_node("llm", _call_model)
        workflow.add_node("tools", ToolNode(TOOLS))
        workflow.set_entry_point("llm")
        workflow.add_conditional_edges("llm", _should_continue, {"continue": "tools", "end": END})
        workflow.add_edge("tools", "llm")
        _graph = workflow.compile()
    return _graph


# --- Session history (for multi-turn chat) ---
_session_messages: dict[str, list[BaseMessage]] = {}


def _ensure_session(session_id: str) -> str:
    if not session_id:
        session_id = secrets.token_hex(12)
    if session_id not in _session_messages:
        _session_messages[session_id] = []
    return session_id


def _format_user_context(profile: dict | None, google_data: dict | None) -> str:
    """Build a context block from full profile and Google data for the agent (day planning)."""
    parts = []
    if profile:
        parts.append("[User profile from app — use this for preferences, work hours, goals, etc.]")
        for k, v in profile.items():
            if k in ("_id", "user_id", "created_at", "updated_at"):
                continue
            if k.startswith("google_"):
                continue
            if v is None or v == "" or (isinstance(v, (list, dict)) and not v):
                continue
            parts.append(f"  {k}: {v}")
        if profile.get("google_synced_at"):
            parts.append(f"  google_synced_at: {profile['google_synced_at']}")
        parts.append("")
    if google_data:
        if google_data.get("calendar") and google_data["calendar"].get("events"):
            parts.append("[Google Calendar — today/upcoming]")
            for e in google_data["calendar"]["events"][:15]:
                parts.append(f"  - {e.get('summary', 'Event')} | {e.get('start', '')} – {e.get('end', '')}")
            parts.append("")
        if google_data.get("tasks") and google_data["tasks"].get("task_lists"):
            parts.append("[Google Tasks]")
            for tl in google_data["tasks"]["task_lists"]:
                for t in (tl.get("tasks") or [])[:10]:
                    parts.append(f"  - {tl.get('list_title', '')}: {t.get('title', '')}")
            parts.append("")
        if google_data.get("gmail") and google_data["gmail"].get("emails"):
            parts.append("[Gmail — recent unread]")
            for em in google_data["gmail"]["emails"][:8]:
                parts.append(f"  - {em.get('subject', '')} | {em.get('from', '')}")
            parts.append("")
    return "\n".join(parts).strip() if parts else ""


def run_chat(
    user_id: str,
    message: str,
    session_id: str = "",
    profile: dict | None = None,
    google_data: dict | None = None,
) -> tuple[str, str]:
    """
    Run the LangGraph + Gemini agent: append user message (with optional profile + Google context),
    invoke graph, return final text and session_id. Session history is preserved.
    """
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return ("Error: GOOGLE_API_KEY or GEMINI_API_KEY is not set.", session_id or "no_session")

    session_id = _ensure_session(session_id)
    history = _session_messages[session_id]

    # Inject profile + Google data so the agent can plan the day with real context
    context = _format_user_context(profile, google_data)
    if context:
        content = f"{context}\n\n---\nUser: {message}"
    else:
        content = message

    # New user turn
    history.append(HumanMessage(content=content))

    # Run graph from current message list
    initial: AgentState = {"messages": history}
    graph = _get_graph()
    final = graph.invoke(initial)

    # Update session with new messages (graph may have appended AIMessage and ToolMessages)
    new_messages = final.get("messages") or []
    _session_messages[session_id] = list(new_messages)

    # Last message should be AIMessage with text (no tool_calls)
    # Gemini/LangChain may return content as str or list of parts (dict or object with type/text)
    def _extract_text(content) -> str:
        if content is None:
            return ""
        if isinstance(content, str):
            return content
        if isinstance(content, list):
            parts = []
            for p in content:
                if isinstance(p, dict):
                    if p.get("type") == "text" and p.get("text"):
                        parts.append(str(p["text"]))
                else:
                    if getattr(p, "type", None) == "text":
                        parts.append(str(getattr(p, "text", "")))
            return " ".join(parts).strip() if parts else ""
        return str(content)

    out_messages = final.get("messages") or []
    for m in reversed(out_messages):
        if isinstance(m, AIMessage) and m.content:
            text = _extract_text(m.content)
            if text:
                return (text.strip(), session_id)

    return ("I couldn't generate a response. Please try again.", session_id)
