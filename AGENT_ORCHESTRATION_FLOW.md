# Agent Orchestration Flow

Flow diagrams for the Day Planner agent: LangGraph + Gemini, context loading, and tool use.

---

## 1. High-level request flow

```mermaid
flowchart LR
    subgraph Client
        App[App / Chat UI]
    end
    subgraph Backend
        API["POST /api/chat\nPOST /api/sleep"]
        LoadCtx["_load_user_context()\n(profile + Google data)"]
        RunAgent["run_agent()"]
        RunChat["run_chat()"]
        Graph["LangGraph\ninvoke"]
    end
    App --> API
    API --> RunAgent
    RunAgent --> LoadCtx
    LoadCtx --> RunChat
    RunChat --> Graph
    Graph --> RunChat
    RunChat --> API
    API --> App
```

- **Client** sends a message (or sleep time) to the backend.
- **Backend** loads profile + Google (Calendar, Tasks, Gmail), then runs the agent with that context.
- **run_chat** injects context into the user message, keeps session history, and invokes the LangGraph once per turn.

---

## 2. LangGraph ReAct loop (agent core)

```mermaid
flowchart TB
    subgraph State
        Messages["messages: [System, Human, AI?, ToolMessage?, ...]"]
    end

    subgraph Graph["LangGraph StateGraph(AgentState)"]
        direction TB
        Entry([Entry]) --> LLM
        LLM["llm node\n_call_model()"]
        Tools["tools node\nToolNode(TOOLS)"]
        LLM --> Cond{"_should_continue()"}
        Cond -->|"tool_calls present"| Tools
        Cond -->|"no tool_calls"| End([END])
        Tools --> LLM
    end

    Entry --> Messages
    LLM --> Messages
    Tools --> Messages
```

- **State:** Single key `messages` (sequence of System, Human, AI, ToolMessage); `add_messages` appends new messages.
- **Entry** is the `llm` node.
- **llm:** Builds `[SystemMessage(SYSTEM_INSTRUCTION)] + state.messages`, calls **Gemini (ChatGoogleGenerativeAI)** with `bind_tools(TOOLS)`, returns one `AIMessage` (text and/or `tool_calls`).
- **_should_continue:** If the last message is an `AIMessage` with `tool_calls` → go to **tools**; otherwise → **END**.
- **tools:** `ToolNode(TOOLS)` runs the requested tools and returns `ToolMessage`s; then the graph goes back to **llm**.
- Loop continues until the model responds with no `tool_calls`, then the run ends.

---

## 3. Context injection and session

```mermaid
flowchart LR
    subgraph Load["Server: _load_user_context(user_id)"]
        DB[(MongoDB\nprofiles)]
        Google["Google APIs\n(if tokens)"]
        Profile["profile"]
        GData["google_data\n(calendar, tasks, gmail)"]
        DB --> Profile
        Google --> GData
    end

    subgraph RunChat["run_chat()"]
        Format["_format_user_context\n(profile, google_data)"]
        CtxBlock["[User profile from app]\n[Google Calendar]\n[Google Tasks]\n[Gmail]"]
        UserMsg["User message"]
        Combined["HumanMessage:\ncontext + '---' + message"]
        History["Session history\n(messages)"]
        Format --> CtxBlock
        CtxBlock --> Combined
        UserMsg --> Combined
        Combined --> History
        History --> Invoke["graph.invoke({ messages })"]
    end

    Profile --> Format
    GData --> Format
```

- **Profile** and **google_data** come from DB and (optionally) live Google APIs.
- **run_chat** turns them into a single context block and prepends it to the user message (`context + "\n\n---\nUser: " + message`), then appends a **HumanMessage** to the session **messages**.
- The same **messages** (with history) are passed to **graph.invoke**; the graph may add multiple AI and Tool messages in one turn.

---

## 4. Tool categories and usage

```mermaid
flowchart TB
    subgraph LLM["Gemini LLM (tool-calling)"]
        Decide["Decides when to call tools"]
    end

    subgraph TOOLS["TOOLS (14 tools)"]
        subgraph Weather["Weather"]
            W1["get_current_weather"]
            W2["get_hourly_forecast"]
            W3["get_travel_advisory"]
        end
        subgraph Maps["Maps"]
            M1["get_directions"]
            M2["recommend_travel_mode"]
        end
        subgraph Gmail["Gmail"]
            G1["scan_inbox_for_actionables"]
            G2["get_email_summary"]
        end
        subgraph Sleep["Sleep"]
            S1["log_sleep"]
            S2["get_sleep_history"]
            S3["cancel_alarm"]
        end
        subgraph Profile["Profile"]
            P1["is_onboarding_needed"]
            P2["get_user_profile"]
            P3["save_user_profile"]
        end
    end

    Decide --> Weather
    Decide --> Maps
    Decide --> Gmail
    Decide --> Sleep
    Decide --> Profile
```

- The **LLM** receives a system instruction that describes all tools and when to use them (day planning, travel, weather, sleep, profile).
- **ToolNode** executes only the tools referenced in the last `AIMessage.tool_calls`; results are added as **ToolMessage**s and the next **llm** call sees them in **messages**.

---

## 5. Single-turn flow (with one tool round)

```mermaid
sequenceDiagram
    participant Client
    participant API
    participant RunAgent
    participant RunChat
    participant Graph
    participant LLM as Gemini
    participant Tools as ToolNode

    Client->>API: POST /api/chat { message, user_id }
    API->>RunAgent: run_agent(user_id, message)
    RunAgent->>RunAgent: _load_user_context(user_id)
    RunAgent->>RunChat: run_chat(..., profile, google_data)
    RunChat->>RunChat: Format context, append HumanMessage
    RunChat->>Graph: invoke({ messages })

    loop ReAct until no tool_calls
        Graph->>LLM: llm node (system + messages)
        LLM-->>Graph: AIMessage (e.g. tool_calls: [recommend_travel_mode])
        Graph->>Graph: _should_continue → "continue"
        Graph->>Tools: tools node (execute tool_calls)
        Tools-->>Graph: ToolMessage(s)
        Graph->>LLM: llm node again (messages + ToolMessages)
        LLM-->>Graph: AIMessage (text, no tool_calls)
        Graph->>Graph: _should_continue → "end"
    end

    Graph-->>RunChat: final state (messages)
    RunChat->>RunChat: Extract last AI text, update session
    RunChat-->>RunAgent: (response_text, session_id)
    RunAgent-->>API: (response_text, session_id)
    API-->>Client: ChatResponse { response, session_id }
```

- One **POST /api/chat** can trigger several **llm** and **tools** steps inside a single **graph.invoke**.
- Session history is updated from the graph’s final **messages** and reused on the next request with the same **session_id**.

---

## 6. Triggers that use the same agent

| Trigger              | Entry point        | Context source              |
|----------------------|--------------------|-----------------------------|
| User chat / day plan | POST /api/chat     | _load_user_context(user_id) |
| Sleep log            | POST /api/sleep    | same                        |
| Morning alarm (cron) | trigger_morning_plan | same                      |

The same **run_agent → run_chat → LangGraph** path is used; only the prompt and (for sleep) post-processing (e.g. alarm scheduling) differ.
