# Faheem Live

Real-time bilingual (English ↔ Arabic) AI tutoring powered by the [Gemini Live API](https://ai.google.dev/api/multimodal-live).

Built for the **Google Gemini Live Agent Challenge**.

---

## Features

- **Voice sessions** — browser mic → Gemini Live → speaker, full duplex audio
- **Text chat** — multi-turn conversation with persistent context
- **Image understanding** — upload a photo (homework, whiteboard, textbook) and ask Faheem about it
- **Bilingual** — detects English or Arabic per turn, code-switches naturally
- **Tool use** — Gemini calls structured local tools: detect problem type, check answers, generate hints, build session recap
- **Stub mode** — full pipeline testable locally with no API key (`GEMINI_STUB=true`)

---

## Architecture

```
Browser (Next.js)
  │  binary PCM frames / JSON text
  ▼
FastAPI  /ws/session
  ├─ text  → LiveClient.generate_text_reply  → Gemini text API (gemini-2.0-flash)
  ├─ image → LiveClient.generate_image_reply → Gemini text API (gemini-2.0-flash, multimodal)
  └─ audio → LiveClient.run                 → Gemini Live API (gemini-2.0-flash-live-001)
```

See [docs/architecture.md](docs/architecture.md) for the full design.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | **Yes** | — | From https://aistudio.google.com/app/apikey |
| `GEMINI_MODEL` | No | `gemini-2.0-flash-live-001` | Gemini Live model (audio) |
| `GEMINI_TEXT_MODEL` | No | `gemini-2.0-flash` | Standard model (text + image) |
| `GEMINI_STUB` | No | `false` | Set `true` to skip all API calls |
| `CORS_ORIGINS` | No | `["http://localhost:3000"]` | JSON array of allowed origins |
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
- A Gemini API key (or use stub mode — see below)

### 1. Backend

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — set GEMINI_API_KEY
uvicorn app.main:app --reload
```

Verify: `curl http://localhost:8000/health`
→ `{"status":"ok","model":"gemini-2.0-flash-live-001","stub":false}`

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
# Edit .env.local if backend is not on localhost:8000
npm run dev
```

Open http://localhost:3000

---

## Stub Mode (no API key required)

```bash
# backend/.env
GEMINI_STUB=true
```

- Text messages echo back `[Stub] You said: …`
- Image messages echo back `[Stub] I see your image! …`
- Audio bridge drains mic input and returns silence
- Full WebSocket pipeline is exercised end-to-end

---

## Real Gemini Mode

```bash
# backend/.env
GEMINI_STUB=false
GEMINI_API_KEY=your_key_here
```

Text and image messages use `gemini-2.0-flash`.
Voice sessions use `gemini-2.0-flash-live-001`.

---

## Cloud Run Deployment

### 1. Build and push

```bash
cd backend
gcloud builds submit --tag gcr.io/YOUR_PROJECT/faheem-backend
```

### 2. Deploy

```bash
gcloud run deploy faheem-backend \
  --image gcr.io/YOUR_PROJECT/faheem-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars GEMINI_API_KEY=your_key,CORS_ORIGINS='["https://your-frontend.vercel.app"]'
```

Cloud Run injects `PORT` automatically; the container binds `0.0.0.0:$PORT`.

### 3. Wire the frontend

Set `NEXT_PUBLIC_WS_URL=wss://faheem-backend-HASH-uc.a.run.app/ws/session` in your frontend deployment environment.

---

## Project Structure

```
faheem-live-gemini/
├── backend/
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── .env.example
│   └── app/
│       ├── main.py                — FastAPI app, CORS, routes
│       ├── config.py              — Pydantic Settings
│       ├── agents/tutor_agent.py  — persona, tool schemas, dispatch, recap
│       ├── models/schemas.py      — shared Pydantic models
│       ├── prompts/system_prompt.md
│       ├── services/live_client.py — Gemini Live + text + image bridge
│       ├── tools/                 — detect_problem_type, check_answer,
│       │                            generate_next_hint, build_session_recap
│       └── ws/session_manager.py  — WebSocket lifecycle, audio queue
├── frontend/
│   ├── src/
│   │   ├── app/session/page.tsx
│   │   ├── components/
│   │   └── hooks/useSessionSocket.ts
│   └── package.json
└── docs/
    ├── architecture.md
    └── demo-script.md
```
