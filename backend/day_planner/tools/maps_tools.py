"""Google Maps tools for the Day Planner agent.

Uses Distance Matrix API to get travel time and distance by mode (driving, walking, bicycling, transit).
Provides recommend_travel_mode to reason about which vehicle to use given weather and durations.
"""

import os
import requests


def _get_api_key() -> str:
    return os.getenv("GOOGLE_MAPS_API_KEY") or os.getenv("GOOGLE_API_KEY") or ""


def get_directions(
    origin: str,
    destination: str,
    mode: str = "driving",
) -> dict:
    """Get travel time and distance between two places using Google Maps Distance Matrix API.

    Args:
        origin: Starting address or place (e.g. "Home", "123 Main St, Chennai").
        destination: Ending address or place (e.g. "Office", "Chennai Hackfest Venue").
        mode: One of "driving", "walking", "bicycling", "transit".

    Returns:
        Dict with duration_text, duration_minutes, distance_text, distance_km, mode, and status.
    """
    api_key = _get_api_key()
    if not api_key:
        return {"error": "GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY not set", "mode": mode}

    mode = mode.lower().strip()
    if mode not in ("driving", "walking", "bicycling", "transit"):
        mode = "driving"

    url = "https://maps.googleapis.com/maps/api/distancematrix/json"
    params = {
        "origins": origin,
        "destinations": destination,
        "mode": mode,
        "key": api_key,
    }
    try:
        resp = requests.get(url, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as e:
        return {"error": str(e), "mode": mode}

    if data.get("status") != "OK":
        return {
            "error": data.get("error_message", data.get("status", "Unknown error")),
            "mode": mode,
        }

    rows = data.get("rows", [])
    if not rows:
        return {"error": "No routes found", "mode": mode}
    elements = rows[0].get("elements", [])
    if not elements:
        return {"error": "No route", "mode": mode}
    el = elements[0]
    if el.get("status") != "OK":
        return {"error": el.get("status", "No route"), "mode": mode}

    duration = el.get("duration", {})
    distance = el.get("distance", {})
    duration_value = duration.get("value", 0)  # seconds
    duration_minutes = round(duration_value / 60, 1) if duration_value else 0
    distance_value = distance.get("value", 0)  # metres
    distance_km = round(distance_value / 1000, 2) if distance_value else 0

    return {
        "origin": origin,
        "destination": destination,
        "mode": mode,
        "duration_text": duration.get("text", ""),
        "duration_minutes": duration_minutes,
        "distance_text": distance.get("text", ""),
        "distance_km": distance_km,
        "status": "OK",
    }


def recommend_travel_mode(
    origin: str,
    destination: str,
    city: str = "",
) -> dict:
    """Recommend which vehicle/mode to use (car, bike, walk, transit) with a reason.

    Uses Google Maps for travel times by driving, walking, bicycling, and transit,
    and weather travel advisory (rain/cold/heat). Returns the best mode and a short reason
    (e.g. "Rain expected: drive 12 min. Bike/walk not recommended." or
    "Pleasant weather. Bike 15 min, drive 10 min — bike recommended for short distance and exercise.").

    Args:
        origin: Starting address or place.
        destination: Ending address or place.
        city: City for weather (optional; uses env USER_CITY if empty).

    Returns:
        Dict with recommended_mode, reason, alternatives (list of mode/duration), weather_note.
    """
    from .weather_tools import get_travel_advisory

    api_key = _get_api_key()
    if not api_key:
        return {"error": "GOOGLE_MAPS_API_KEY or GOOGLE_API_KEY not set"}

    advisory = get_travel_advisory(city)
    weather_note = ""
    weather_blocks_bike_walk = False
    if "error" not in advisory:
        weather_note = advisory.get("reason", "")
        rec = advisory.get("recommended_mode", "")
        weather_blocks_bike_walk = rec in ("car", "stay_indoors")

    modes_to_try = ["driving", "walking", "bicycling", "transit"]
    results = {}
    for m in modes_to_try:
        r = get_directions(origin, destination, mode=m)
        if "error" not in r:
            results[m] = {
                "duration_text": r.get("duration_text", ""),
                "duration_minutes": r.get("duration_minutes", 0),
            }
        else:
            results[m] = {"error": r.get("error"), "duration_minutes": 999}

    # Build recommendation
    alternatives = []
    for m, v in results.items():
        if v.get("error"):
            continue
        mn = v.get("duration_minutes", 999)
        alternatives.append({"mode": m, "duration_text": v.get("duration_text", ""), "duration_minutes": mn})

    if not alternatives:
        return {
            "error": "Could not get travel times for any mode",
            "weather_note": weather_note,
        }

    # Prefer driving if weather blocks bike/walk
    if weather_blocks_bike_walk:
        drive = next((a for a in alternatives if a["mode"] == "driving"), None)
        if drive:
            return {
                "recommended_mode": "driving",
                "reason": f"{weather_note} Use car ({drive['duration_text']}).",
                "alternatives": alternatives,
                "weather_note": weather_note,
            }
        # fallback to shortest
        best = min(alternatives, key=lambda x: x["duration_minutes"])
        return {
            "recommended_mode": best["mode"],
            "reason": f"{weather_note} Best available: {best['mode']} ({best['duration_text']}).",
            "alternatives": alternatives,
            "weather_note": weather_note,
        }

    # Pleasant weather: pick a sensible default (short trip -> bike/walk if similar time)
    drive = next((a for a in alternatives if a["mode"] == "driving"), None)
    bike = next((a for a in alternatives if a["mode"] == "bicycling"), None)
    walk = next((a for a in alternatives if a["mode"] == "walking"), None)
    transit = next((a for a in alternatives if a["mode"] == "transit"), None)

    drive_mins = drive["duration_minutes"] if drive else 999
    bike_mins = bike["duration_minutes"] if bike else 999
    walk_mins = walk["duration_minutes"] if walk else 999

    # Prefer bike or walk for short distances when weather is fine
    if bike and bike_mins <= 25 and bike_mins <= drive_mins * 1.8:
        reason = f"Pleasant weather. Bike {bike['duration_text']}, drive {drive['duration_text'] if drive else 'N/A'} — bike recommended for this distance."
        return {
            "recommended_mode": "bicycling",
            "reason": reason,
            "alternatives": alternatives,
            "weather_note": weather_note,
        }
    if walk and walk_mins <= 20 and walk_mins <= drive_mins * 2:
        reason = f"Pleasant weather. Walk {walk['duration_text']}, drive {drive['duration_text'] if drive else 'N/A'} — walk recommended (short distance)."
        return {
            "recommended_mode": "walking",
            "reason": reason,
            "alternatives": alternatives,
            "weather_note": weather_note,
        }
    # Otherwise recommend fastest
    best = min(alternatives, key=lambda x: x["duration_minutes"])
    reason = f"Weather OK. Fastest: {best['mode']} ({best['duration_text']}). Alternatives: " + ", ".join(
        f"{a['mode']} {a['duration_text']}" for a in alternatives if a != best
    )[:120]
    return {
        "recommended_mode": best["mode"],
        "reason": reason,
        "alternatives": alternatives,
        "weather_note": weather_note,
    }
