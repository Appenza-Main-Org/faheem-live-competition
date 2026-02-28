# Faheem Live — Architecture

## Overview

Faheem Live is a real-time bilingual tutoring application. A student speaks (or types, or uploads images) in English or Arabic; Faheem, the AI tutor, responds in the same language with contextual pedagogical feedback.

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                        Browser                          │
│                                                         │
│   ┌──────────┐   ┌──────────────┐   ┌──────────────┐   │
│   │Microphone│   │  Text / Chat │   │ Image Upload │   │
│   └────┬─────┘   └──────┬───────┘   └──────┬───────┘   │
│        │ PCM 16kHz       │ JSON              │ base64    │
└────────┼─────────────────┼──────────────────┼───────────┘
         │                 │                  │
         ▼                 ▼                  ▼
┌─────────────────────────────────────────────────────────┐
│             FastAPI  /ws/session  (Cloud Run)           │
│                                                         │
│   session_manager.py                                    │
│   ┌─────────────────────────────────────────────────┐   │
│   │  receive_loop ── audio_queue ── bridge_task     │   │
│   │       │                             │           │   │
│   │  handle_text_message            LiveClient.run  │   │
│   └──────────┬──────────────────────────┬───────────┘   │
│              │                          │               │
│   ┌──────────┴──────────┐   ┌───────────┴────────────┐  │
│   │  generate_text_reply│   │  generate_image_reply  │  │
│   │  _call_text_api     │   │  _call_image_api       │  │
│   └──────────┬──────────┘   └───────────┬────────────┘  │
│              │                          │               │
│         Gemini text API           Gemini text API       │
│         (gemini-2.0-flash)        (gemini-2.0-flash,    │
│                                    multimodal)          │
│                                                         │
│                    LiveClient._run_live                 │
│                    ┌────────────────────┐               │
│                    │  _upstream task    │               │
│                    │  _downstream task  │               │
│                    └─────────┬──────────┘               │
│                              │                          │
│                    Gemini Live API                      │
│                    (gemini-2.0-flash-live-001)          │
└──────────────────────────────┬──────────────────────────┘
                               │
                    binary PCM / JSON text
                               │
                        Browser speaker
```

---

## Audio Path (Voice Sessions)

1. Browser captures mic at 16 kHz mono (`AudioContext` + `ScriptProcessorNode`)
2. Float32 samples converted to Int16 PCM, sent as binary WebSocket frames
3. `receive_loop` enqueues chunks on `asyncio.Queue[bytes | None]`
4. `LiveClient._upstream` drains the queue, forwards to Gemini Live via `session.send_realtime_input()`
5. `LiveClient._downstream` reads `session.receive()`, forwards audio `inline_data` parts to the browser as binary frames
6. Browser plays PCM at 24 kHz using a second `AudioContext` with time-stitched scheduling

Concurrency pattern — two tasks per session:
```
receive_loop  ──(audio chunks)──►  asyncio.Queue  ──►  _upstream  ──►  Gemini Live
                                                                              │
browser  ◄──────────────────(binary frames)──────  _downstream  ◄───────────┘
```

---

## Text Path

1. Student types; browser sends `{"type":"text","text":"..."}`
2. `handle_text_message` calls `LiveClient.generate_text_reply(user_text, system_prompt, history)`
3. Stub mode: returns `[Stub] You said: …` immediately
4. Live mode: `_call_text_api` builds `Content` list from `chat_history` + new user turn, calls `gai_client.aio.models.generate_content()` with `gemini-2.0-flash`
5. Reply sent as `{"type":"message","role":"tutor","text":"..."}`
6. `chat_history` updated — provides multi-turn context on next message

---

## Image Path

1. Student uploads image + optional caption; browser encodes to base64, sends:
   ```json
   {"type":"image","mimeType":"image/jpeg","data":"<base64>","caption":"..."}
   ```
2. `handle_text_message` calls `LiveClient.generate_image_reply(image_b64, mime_type, caption, system_prompt, history)`
3. Stub mode: returns `[Stub] I see your image! …` immediately
4. Live mode: `_call_image_api` decodes base64 → bytes, builds a multimodal `Content` with:
   - `types.Blob(data=image_bytes, mime_type=mime_type)` as `inline_data` Part
   - Optional caption as a second text Part
   - Prior `chat_history` as context turns
5. Same `generate_content()` call — Gemini understands the image
6. Reply sent as tutor message; `chat_history` gets `"[Image sent] <caption>"` text entry

---

## Tool Use

Declared in `TutorAgent._TOOL_SCHEMAS`, sent to Gemini at Live session start:

| Tool | Trigger | Returns |
|---|---|---|
| `detect_problem_type` | Gemini identifies a student difficulty | `{problem_type, confidence, reasoning}` |
| `check_answer` | Student answers a posed question | `{verdict, correction, explanation}` |
| `generate_next_hint` | Student is stuck | `{hint, hint_level, language}` |
| `build_session_recap` | Student signals end of session | `{summary, score, topics, mistakes}` |

`TutorAgent.dispatch_tool_calls()` receives the Gemini `tool_call` object, runs the matching Python function from `_TOOL_REGISTRY`, records the event in `_events`, and returns `FunctionResponse` objects to the session.

---

## Key Files

| File | Role |
|---|---|
| `backend/app/main.py` | FastAPI app, CORS, `/health`, `/ws/session` route |
| `backend/app/config.py` | Pydantic Settings — loads `.env` |
| `backend/app/ws/session_manager.py` | WebSocket lifecycle, audio queue, message dispatch |
| `backend/app/services/live_client.py` | Gemini Live + text + image API bridge |
| `backend/app/agents/tutor_agent.py` | Faheem persona, tool schemas, dispatch, recap |
| `backend/app/prompts/system_prompt.md` | Faheem's system instruction |
| `backend/app/tools/` | Local tool implementations |
| `frontend/src/hooks/useSessionSocket.ts` | All WebSocket + transcript state |
| `frontend/src/components/SessionControls.tsx` | Start/Stop UI |

---

## Stub Mode

When `GEMINI_STUB=true`:

- `LiveClient._run_stub` drains audio and echoes silence (verifies the queue/task pipeline)
- `generate_text_reply` returns `[Stub] You said: …`
- `generate_image_reply` returns `[Stub] I see your image! …`
- No credentials required — entire stack exercisable locally

---

## Deployment

```
Docker image (python:3.12-slim)
  └── uvicorn app.main:app --host 0.0.0.0 --port $PORT
        └── Cloud Run (PORT injected automatically, default 8080)
```

CORS origins are set via the `CORS_ORIGINS` env var (JSON array string) so the deployed backend accepts requests from the frontend domain.
