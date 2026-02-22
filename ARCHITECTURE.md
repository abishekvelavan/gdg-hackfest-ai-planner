# GDG Hackfest AI Day Planner — Architecture

High-level architecture for the Day Planner: Expo mobile app, FastAPI backend, LangGraph + Gemini agent, MongoDB, Google APIs, and Firebase.

---

## 1. System overview

```mermaid
flowchart TB
    subgraph Client["Mobile App (Expo / React Native)"]
        UI[App UI]
        Tabs[Your Plan · Chat · Sleep · Profile]
        Auth[AuthContext]
        API_Client[services/api.ts]
        UI --> Tabs
        UI --> Auth
        Tabs --> API_Client
        Auth --> API_Client
    end

    subgraph Backend["Backend (FastAPI)"]
        Server[server.py]
        API[API Routes]
        Agent[day_planner/agent.py]
        Ctx[_load_user_context]
        Server --> API
        API --> Ctx
        API --> Agent
        Ctx --> Agent
    end

    subgraph Data["Data & External"]
        MongoDB[(MongoDB)]
        Google[Google APIs\nGmail · Calendar · Tasks]
        Firebase[Firebase FCM]
        Weather[Weather API]
        Maps[Google Maps]
        MongoDB --> Ctx
        Google --> Ctx
        Ctx --> MongoDB
        Agent --> Weather
        Agent --> Maps
        Server --> Firebase
    end

    API_Client <-->|HTTPS| API
    Agent --> Google
```



- **Client:** Expo app with tab navigation (Your Plan, Chat, Sleep, Profile), auth (login/register), and a central API client.
- **Backend:** FastAPI server that loads user context (profile + Google data) and runs the LangGraph + Gemini agent.
- **Data:** MongoDB for users, profiles, and Google tokens; Google for Gmail/Calendar/Tasks and Maps; Firebase for push notifications; weather and maps used by the agent.

---

## 2. Backend architecture

```mermaid
StateGraph
flowchart LR
    subgraph API["FastAPI (server.py)"]
        Chat["POST /api/chat"]
        Sleep["POST /api/sleep"]
        Profile["POST /api/profile"]
        Auth["/api/register\n/api/login"]
        Google["/api/google/*"]
        Plan["/api/plan/add-to-calendar"]
        FCM["/api/fcm-token\n/api/notify"]
        Health["GET /api/health"]
    end

    subgraph Agent["LangGraph Agent"]
        LoadCtx[_load_user_context]
        RunChat[run_chat]
        Graph[StateGraph]
        LLM[Gemini LLM]
        Tools[ToolNode]
        LoadCtx --> RunChat
        RunChat --> Graph
        Graph --> LLM
        LLM --> Tools
        Tools --> LLM
    end

    subgraph Infra["Infrastructure"]
        DB[(MongoDB)]
        Scheduler[APScheduler]
        FCM_Svc[Firebase FCM]
    end

    Chat --> LoadCtx
    Sleep --> LoadCtx
    Profile --> DB
    Auth --> DB
    Google --> DB
    Plan --> Google
    Scheduler --> RunChat
    RunChat --> FCM_Svc
```



- **API:** Chat and sleep go through the agent; profile, auth, Google OAuth/sync, add-to-calendar, FCM, and health are separate routes.
- **Agent:** Context is loaded (profile + Google), then `run_chat` runs the LangGraph (LLM + tools) and returns the reply.
- **Infra:** MongoDB for persistence; APScheduler for morning alarms; Firebase for push notifications.

---

## 3. Mobile app structure

```mermaid
flowchart TB
    subgraph App["Expo App (app/)"]
        Root[_layout.tsx\nAuthProvider, Theme]
        Login[login]
        Welcome[welcome]
        ConnectGoogle[connect-google]
        Tabs["(tabs)"]
        Map[map]
        Modal[modal]
        Root --> Login
        Root --> Welcome
        Root --> ConnectGoogle
        Root --> Tabs
        Root --> Map
        Root --> Modal
    end

    subgraph TabsDetail["(tabs) — TabLayout"]
        YourPlan["Your Plan\nindex.tsx"]
        Chat[chat.tsx]
        Sleep[sleep]
        Profile[profile.tsx]
    end

    subgraph Shared["Shared"]
        API[services/api.ts]
        Types[types/index.ts]
        Colors[constants/Colors.ts]
        Components[PlanCard, EventTile, ChatBubble, ...]
    end

    Tabs --> YourPlan
    Tabs --> Chat
    Tabs --> Sleep
    Tabs --> Profile
    YourPlan --> API
    Chat --> API
    Sleep --> API
    Profile --> API
    YourPlan --> Components
    Chat --> Components
```



- **Root:** Auth-gated navigation; redirects to login → welcome (onboarding) or connect-google → (tabs).
- **Tabs:** Your Plan (day plan + map), Chat (agent), Sleep (log + alarm), Profile (settings + Google link).
- **Shared:** Single API client, types, theme, and reusable components.

---

## 4. Agent flow (LangGraph + Gemini)

```mermaid
flowchart TB
    subgraph State["State"]
        Messages["messages: [System, Human, AI?, ToolMessage?, ...]"]
    end

    subgraph Graph["LangGraph"]
        Entry([Entry]) --> LLM
        LLM["llm node\nGemini + bind_tools"]
        Cond{"_should_continue"}
        Tools["ToolNode\n(14 tools)"]
        LLM --> Cond
        Cond -->|"tool_calls"| Tools
        Cond -->|"no tool_calls"| End([END])
        Tools --> LLM
    end

    Messages --> LLM
    LLM --> Messages
    Tools --> Messages
```



- **State:** Single `messages` list (system, user, assistant, tool messages); reducer appends new messages.
- **Flow:** Entry → LLM → if tool_calls → ToolNode → back to LLM; else END.
- **Tools:** Weather (3), Maps (2), Gmail (2), Sleep (3), Profile (3), etc. — all invoked by the LLM via tool_calls.

---

## 5. Data flow (request → response)

```mermaid
sequenceDiagram
    participant App as Mobile App
    participant API as FastAPI
    participant Ctx as _load_user_context
    participant DB as MongoDB
    participant Google as Google APIs
    participant Agent as run_chat / LangGraph
    participant Gemini as Gemini
    participant Tools as ToolNode

    App->>API: POST /api/chat { message, user_id }
    API->>Ctx: _load_user_context(user_id)
    Ctx->>DB: get_profile, get_google_tokens
    Ctx->>Google: (optional) fetch Gmail, Calendar, Tasks
    Ctx-->>API: profile, google_data
    API->>Agent: run_chat(message, profile, google_data)
    Agent->>Agent: Format context + append HumanMessage
    Agent->>Gemini: invoke graph (system + messages)
    loop ReAct
        Gemini-->>Agent: AIMessage (tool_calls?)
        Agent->>Tools: execute tool_calls
        Tools-->>Agent: ToolMessages
        Agent->>Gemini: invoke again with ToolMessages
    end
    Gemini-->>Agent: final AIMessage (text)
    Agent-->>API: response_text, session_id
    API-->>App: ChatResponse { response, session_id }
```



- One chat request triggers context load (DB + optional Google), then a single `run_chat` → graph invoke; the graph may run multiple LLM/tool steps (ReAct) before returning the final text.

---

## 6. Key files


| Layer       | Path                             | Purpose                                                                  |
| ----------- | -------------------------------- | ------------------------------------------------------------------------ |
| Backend API | `backend/server.py`              | FastAPI app, routes, CORS, scheduler, FCM, _load_user_context, run_agent |
| Agent       | `backend/day_planner/agent.py`   | LangGraph StateGraph, Gemini, tools, run_chat, session history           |
| DB          | `backend/db.py`                  | MongoDB connection, users, profiles, google_tokens                       |
| Tools       | `backend/day_planner/tools/*.py` | weather, gmail, sleep, profile, maps                                     |
| Mobile API  | `mobile/services/api.ts`         | All backend calls (chat, sleep, profile, auth, Google, FCM, etc.)        |
| Root layout | `mobile/app/_layout.tsx`         | AuthProvider, Stack (login, welcome, connect-google, (tabs), map, modal) |
| Tabs        | `mobile/app/(tabs)/_layout.tsx`  | Tab bar: Your Plan, Chat, Sleep, Profile                                 |


For detailed agent orchestration (context injection, tool list, single-turn flow), see [AGENT_ORCHESTRATION_FLOW.md](./AGENT_ORCHESTRATION_FLOW.md).