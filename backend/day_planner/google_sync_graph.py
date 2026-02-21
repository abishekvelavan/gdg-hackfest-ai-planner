"""
LangGraph sync flow: after profile is stored and Google is connected,
fetch Gmail, Calendar, and Google Tasks (no Google ADK).
"""

from typing import TypedDict

from langgraph.graph import StateGraph, END

from .google_services import fetch_gmail_summary, fetch_calendar_events, fetch_google_tasks


class GoogleSyncState(TypedDict):
    user_id: str
    gmail: dict
    calendar: dict
    tasks: dict
    error: str | None


def _node_gmail(state: GoogleSyncState) -> GoogleSyncState:
    user_id = state["user_id"]
    result = fetch_gmail_summary(user_id, max_emails=10)
    return {**state, "gmail": result}


def _node_calendar(state: GoogleSyncState) -> GoogleSyncState:
    user_id = state["user_id"]
    result = fetch_calendar_events(user_id, days_ahead=2)
    return {**state, "calendar": result}


def _node_tasks(state: GoogleSyncState) -> GoogleSyncState:
    user_id = state["user_id"]
    result = fetch_google_tasks(user_id, max_lists=5)
    return {**state, "tasks": result}


def build_google_sync_graph():
    """Build and compile the LangGraph for Google data sync."""
    try:
        graph = StateGraph(state_schema=GoogleSyncState)
    except TypeError:
        graph = StateGraph(GoogleSyncState)

    graph.add_node("gmail", _node_gmail)
    graph.add_node("calendar", _node_calendar)
    graph.add_node("tasks", _node_tasks)

    graph.set_entry_point("gmail")
    graph.add_edge("gmail", "calendar")
    graph.add_edge("calendar", "tasks")
    graph.add_edge("tasks", END)

    return graph.compile()


def run_google_sync(user_id: str) -> dict:
    """Run the LangGraph sync for the user. Returns merged gmail, calendar, tasks."""
    compiled = build_google_sync_graph()
    initial: GoogleSyncState = {
        "user_id": user_id,
        "gmail": {},
        "calendar": {},
        "tasks": {},
        "error": None,
    }
    final = compiled.invoke(initial)
    return {
        "gmail": final.get("gmail") or {},
        "calendar": final.get("calendar") or {},
        "tasks": final.get("tasks") or {},
    }
