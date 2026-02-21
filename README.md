# Agentic Day Planner

An intelligent multi-agent day planner powered by **Google ADK**, **Gemini 3.0 Flash**, **MCP**, and **Firebase Cloud Messaging**.

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+ (for MCP servers)
- Google Cloud credentials (`credentials.json`)
- API keys (Gemini, Maps, OpenWeatherMap, Notion)

### Setup

```bash
# 1. Install Python dependencies
cd backend
pip install -r requirements.txt

# 2. Configure API keys
cp day_planner/.env.example day_planner/.env
# Edit .env with your API keys

# 3. Place Google OAuth credentials
# Download from GCP Console → APIs & Services → Credentials
# Save as backend/credentials.json

# 4. Run the server
python server.py
# or: uvicorn server:app --reload --port 8000
```

### API Endpoints

| Endpoint | Method | Description |
|---|---|---|
| `/api/chat` | POST | Chat with the Day Planner agent |
| `/api/sleep` | POST | Log bedtime + schedule alarm |
| `/api/morning-plan` | POST | Trigger morning plan (scheduler/manual) |
| `/api/fcm-token` | POST | Register device FCM token |
| `/api/notify` | POST | Send test notification |
| `/api/health` | GET | Health check |

### Architecture

- **7 ADK Sub-Agents**: Calendar (MCP), Notion (MCP), Maps (MCP), Weather, Gmail, Sleep, Profile
- **Gemini 3.0 Flash**: All agents use Gemini 3.0 Flash for reasoning
- **React Native (Expo)**: Mobile app with push notifications
- **Cloud Run**: Production deployment
- **Cloud Scheduler**: Production morning alarm cron
