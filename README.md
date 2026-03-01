# Faheem Math — Live AI Math Tutor

Real-time, voice-first, vision-enabled math tutor powered by the [Gemini Live API](https://ai.google.dev/api/multimodal-live).

Built for the **Google Gemini Live Agent Challenge** — Live Agents category.

---

## What it does

- **Voice sessions** — speak a math problem; Faheem explains it in real time (full-duplex audio via Gemini Live)
- **Image upload** — snap or upload homework; Faheem reads and solves it step by step
- **Text chat** — multi-turn conversation with persistent session context
- **Three modes** — Explain / Quiz / Homework, switchable mid-session
- **Live agent states** — Ready → Connecting → Live → Listening → Speaking → Interrupted, visible in the UI
- **Tool use** — Gemini calls structured local tools: classify problem type, check answers, generate hints, build session recap
- **Stub mode** — full pipeline testable without an API key (`GEMINI_STUB=true`)

---

## Architecture

```
Browser (Next.js)
  │  binary PCM frames (mic → speaker)
  │  JSON frames (text / image / control)
  ▼
FastAPI  /ws/session  (single WebSocket)
  ├─ text  → LiveClient.generate_text_reply  → Gemini text API
  ├─ image → LiveClient.generate_image_reply → Gemini multimodal API
  └─ audio → LiveClient.run                 → Gemini Live API (bidirectional)
```

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | **Yes** | — | [Get a key](https://aistudio.google.com/app/apikey) |
| `GEMINI_MODEL` | No | `gemini-2.5-flash-native-audio-latest` | Gemini Live model (audio) |
| `GEMINI_TEXT_MODEL` | No | `gemini-2.5-flash` | Standard model (text + image) |
| `GEMINI_STUB` | No | `false` | `true` = skip all API calls |
| `CORS_ORIGINS` | No | `["http://localhost:3000"]` | Allowed origins (JSON array) |
| `LOG_LEVEL` | No | `INFO` | Python log level |

### Frontend (`frontend/.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_WS_URL` | No | `ws://localhost:8000/ws/session` | Backend WebSocket URL |

---

## Local Development

### Prerequisites

- Python 3.11+
- Node.js 18+
- A Gemini API key (or use stub mode)

### Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set GEMINI_API_KEY
uvicorn app.main:app --reload
```

Verify: `curl http://localhost:8000/health`
→ `{"status":"ok","model":"gemini-2.5-flash-native-audio-latest","stub":false}`

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Stub Mode

```bash
# backend/.env
GEMINI_STUB=true
```

Text, image, and audio all return canned responses. Full WebSocket pipeline is exercised without any API calls or credentials.

---

## Cloud Run Deployment (backend)

### Prerequisites

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gcloud services enable run.googleapis.com cloudbuild.googleapis.com
```

### Deploy (single command, from repo root)

```bash
gcloud run deploy faheem-backend \
  --source backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars "GEMINI_API_KEY=YOUR_KEY,CORS_ORIGINS=[\"https://your-frontend.vercel.app\"]"
```

Cloud Run automatically builds the container from `backend/Dockerfile`, injects `PORT`, and the app binds `0.0.0.0:$PORT`.

Note your deployed URL: `https://faheem-backend-HASH-uc.a.run.app`

### Wire the frontend

Set in your frontend deployment environment:

```
NEXT_PUBLIC_WS_URL=wss://faheem-backend-HASH-uc.a.run.app/ws/session
```

### Verify deployment

```bash
curl https://faheem-backend-HASH-uc.a.run.app/health
# → {"status":"ok","model":"gemini-2.5-flash-native-audio-latest","stub":false}
```

---

## Frontend Deployment (Vercel)

```bash
cd frontend
npx vercel --prod
# Add NEXT_PUBLIC_WS_URL in Vercel project settings → Environment Variables
```

---

## Project Structure

```
faheem-live-gemini/
├── backend/
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py                  FastAPI app, CORS, /health, /ws/session
│       ├── config.py                Pydantic Settings
│       ├── agents/tutor_agent.py    Faheem persona, tool schemas, recap
│       ├── models/schemas.py        Shared Pydantic models
│       ├── prompts/system_prompt.md Math tutor system prompt
│       ├── services/live_client.py  Gemini Live + text + image bridge
│       ├── tools/                   detect_problem_type, check_answer,
│       │                            generate_next_hint, build_session_recap
│       └── ws/session_manager.py    WebSocket lifecycle, audio queue
└── frontend/
    ├── src/
    │   ├── app/session/page.tsx     Main session UI
    │   ├── components/              TranscriptPanel, ModeSelector
    │   ├── hooks/useSessionSocket.ts Primary hook (WS + audio + live state)
    │   └── lib/log.ts               Structured console logging
    ├── .env.local.example
    └── package.json
```
