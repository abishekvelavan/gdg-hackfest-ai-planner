"""Weather tools for the Day Planner agent.

Uses OpenWeatherMap API to get current weather, hourly forecasts,
and travel advisories (bike/car/stay-in).
"""

import os
import requests
from datetime import datetime


def get_current_weather(city: str = "") -> dict:
    """Get current weather conditions for a city.

    Args:
        city: City name. If not provided, uses USER_CITY from env.

    Returns:
        Dictionary with temperature, conditions, humidity, wind speed,
        and a human-readable summary.
    """
    city = city or os.getenv("USER_CITY", "Chennai")
    api_key = os.getenv("OPENWEATHER_API_KEY", "")

    if not api_key:
        return {"error": "OPENWEATHER_API_KEY not set", "city": city}

    try:
        url = "https://api.openweathermap.org/data/2.5/weather"
        params = {"q": city, "appid": api_key, "units": "metric"}
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        weather = {
            "city": city,
            "temperature_c": data["main"]["temp"],
            "feels_like_c": data["main"]["feels_like"],
            "humidity_percent": data["main"]["humidity"],
            "conditions": data["weather"][0]["description"],
            "wind_speed_kmh": round(data["wind"]["speed"] * 3.6, 1),
            "icon": data["weather"][0]["icon"],
            "summary": (
                f"{city}: {data['main']['temp']}°C, "
                f"{data['weather'][0]['description']}, "
                f"humidity {data['main']['humidity']}%, "
                f"wind {round(data['wind']['speed'] * 3.6, 1)} km/h"
            ),
        }
        return weather
    except requests.RequestException as e:
        return {"error": f"Weather API error: {str(e)}", "city": city}


def get_hourly_forecast(city: str = "") -> dict:
    """Get hourly weather forecast for today.

    Args:
        city: City name. If not provided, uses USER_CITY from env.

    Returns:
        Dictionary with hourly forecast entries for the next 12 hours,
        including temperature, conditions, and rain probability.
    """
    city = city or os.getenv("USER_CITY", "Chennai")
    api_key = os.getenv("OPENWEATHER_API_KEY", "")

    if not api_key:
        return {"error": "OPENWEATHER_API_KEY not set", "city": city}

    try:
        url = "https://api.openweathermap.org/data/2.5/forecast"
        params = {"q": city, "appid": api_key, "units": "metric", "cnt": 12}
        response = requests.get(url, params=params, timeout=10)
        response.raise_for_status()
        data = response.json()

        hourly = []
        for entry in data.get("list", []):
            dt = datetime.fromtimestamp(entry["dt"])
            hourly.append({
                "time": dt.strftime("%I:%M %p"),
                "temperature_c": entry["main"]["temp"],
                "conditions": entry["weather"][0]["description"],
                "rain_probability": entry.get("pop", 0) * 100,
                "wind_speed_kmh": round(entry["wind"]["speed"] * 3.6, 1),
            })

        return {"city": city, "forecast": hourly}
    except requests.RequestException as e:
        return {"error": f"Forecast API error: {str(e)}", "city": city}


def get_travel_advisory(city: str = "") -> dict:
    """Get travel mode recommendation based on current weather.

    Analyzes weather conditions and recommends whether to bike, drive,
    or stay indoors.

    Args:
        city: City name. If not provided, uses USER_CITY from env.

    Returns:
        Dictionary with recommended travel mode, reason, and weather summary.
    """
    weather = get_current_weather(city)

    if "error" in weather:
        return weather

    temp = weather["temperature_c"]
    wind = weather["wind_speed_kmh"]
    conditions = weather["conditions"].lower()

    # Determine travel advisory
    rain_keywords = ["rain", "drizzle", "thunderstorm", "shower"]
    extreme_keywords = ["storm", "tornado", "hurricane", "blizzard"]
    is_rainy = any(kw in conditions for kw in rain_keywords)
    is_extreme = any(kw in conditions for kw in extreme_keywords)

    if is_extreme:
        mode = "stay_indoors"
        reason = f"Extreme weather: {conditions}. Stay safe indoors."
    elif is_rainy or wind > 40:
        mode = "car"
        reason = f"{'Rain' if is_rainy else 'High wind'} detected. Drive instead of biking."
    elif temp > 40:
        mode = "car"
        reason = f"Extreme heat ({temp}°C). Use air-conditioned transport."
    elif temp < 5:
        mode = "car"
        reason = f"Very cold ({temp}°C). Drive to stay warm."
    else:
        mode = "bike_or_walk"
        reason = f"Pleasant weather ({temp}°C, {conditions}). Great for biking or walking!"

    return {
        "recommended_mode": mode,
        "reason": reason,
        "weather_summary": weather["summary"],
        "city": weather["city"],
    }
