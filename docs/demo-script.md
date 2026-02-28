# Faheem Live — Demo Script

Step-by-step walkthrough for challenge judges evaluating the submission.

---

## 1. Setup (5 minutes)

### Clone and configure

```bash
git clone https://github.com/YOUR_ORG/faheem-live-gemini.git
cd faheem-live-gemini
```

**Backend:**
```bash
cd backend
cp .env.example .env
# Open .env — set GEMINI_API_KEY=<your key>
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend (new terminal):**
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

---

## 2. Stub Mode Smoke Test (no API key needed)

Set `GEMINI_STUB=true` in `backend/.env`, restart uvicorn, then verify the full pipeline:

```bash
curl http://localhost:8000/health
# → {"status":"ok","model":"gemini-2.0-flash-live-001","stub":true}
```

Open http://localhost:3000 → click **Start Session** → type a message → receive `[Stub] You said: …`

This confirms the WebSocket, queue, and browser transcript work without any credentials.

---

## 3. Text Chat Demo

With `GEMINI_STUB=false` and a valid API key:

1. Open http://localhost:3000
2. Click **Start Session**
3. Type: *"What is the Arabic word for 'apple'?"*
4. Faheem replies in both languages, code-switching naturally
5. Type a follow-up: *"Can you use it in a sentence?"*
6. Observe multi-turn context — Faheem remembers the previous exchange

---

## 4. Image Understanding Demo

1. Take a photo of handwritten Arabic text, a textbook page, or a math problem
2. In the session panel, drag-and-drop or click the upload area to select the image
3. Add a caption: *"What does this say?"* or *"Help me solve this"*
4. Click **Send image**
5. Faheem analyses the image and responds in the appropriate language

---

## 5. Voice Session Demo

*(Requires Chrome or Edge — Safari is not supported for raw PCM streaming)*

1. Click **Start Session** → grant microphone permission when prompted
2. Speak in English: *"Hello Faheem, I want to practice Arabic greetings"*
3. Hear Faheem's audio response through your speakers
4. Continue the conversation — notice automatic language detection per turn
5. Speak in Arabic to trigger a code-switch response
6. Click **Stop Session** — observe the session recap card in the transcript

---

## 6. Tool Use (observe in server logs)

During a voice session, watch the backend terminal. Gemini initiates function calls that appear as:

```
INFO  Tool call: detect_problem_type({'utterance': '...', 'context': '...'})
INFO  Tool call: check_answer({'question': '...', 'student_answer': '...', 'expected_answer': '...'})
INFO  Tool call: generate_next_hint({'problem': '...', 'hint_level': 1})
INFO  Tool call: build_session_recap({'session_id': '...', 'topics': [...], ...})
```

These are dispatched by `TutorAgent.dispatch_tool_calls()` and results returned to Gemini as `FunctionResponse` objects.

---

## 7. Cloud Run Verification

If testing against the deployed backend:

```bash
curl https://faheem-backend-HASH-uc.a.run.app/health
# → {"status":"ok","model":"gemini-2.0-flash-live-001","stub":false}
```

Open the frontend URL and repeat steps 3–5 against the production backend.

---

## Key Demo Talking Points

| Feature | What to show |
|---|---|
| Bilingual detection | Ask in English, get mixed response; ask in Arabic, get Arabic-first response |
| Multi-turn memory | Reference something from 3 turns ago — Faheem remembers |
| Image understanding | Upload a photo with Arabic text — Faheem reads and explains it |
| Tool use | Watch the logs for `check_answer` verdict decisions |
| Stub mode | Show full stack working with `GEMINI_STUB=true` — no credentials |
| Session recap | End a session — see the structured recap card in the transcript |
