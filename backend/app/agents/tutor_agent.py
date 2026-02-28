"""
TutorAgent — orchestrates the Faheem tutoring persona.

Responsibilities:
- Loads the system prompt from prompts/system_prompt.md
- Declares Gemini function schemas for all four tools
- Dispatches tool calls received from Gemini to local tool functions
- Accumulates session events and builds end-of-session recaps

Note: google.genai types are imported lazily (inside build_live_config) so this
module can be imported and tested without a live API connection.
"""

import logging
from pathlib import Path

from app.models.schemas import SessionConfig, SessionRecap
from app.tools import (
    build_session_recap,
    check_answer,
    detect_problem_type,
    generate_next_hint,
)

logger = logging.getLogger(__name__)

_PROMPT_FILE = Path(__file__).parent.parent / "prompts" / "system_prompt.md"

# Maps Gemini function-call names -> local tool run() functions
_TOOL_REGISTRY: dict = {
    "detect_problem_type": detect_problem_type.run,
    "check_answer": check_answer.run,
    "generate_next_hint": generate_next_hint.run,
    "build_session_recap": build_session_recap.run,
}

# JSON-schema declarations sent to Gemini at session start
_TOOL_SCHEMAS: list[dict] = [
    {
        "name": "detect_problem_type",
        "description": (
            "Identify the type of language problem the student is facing: "
            "vocabulary, grammar, pronunciation, or comprehension."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "utterance": {
                    "type": "string",
                    "description": "The student's spoken or written input.",
                },
                "context": {
                    "type": "string",
                    "description": "Optional surrounding conversation context.",
                },
            },
            "required": ["utterance"],
        },
    },
    {
        "name": "check_answer",
        "description": (
            "Verify whether the student's answer to a posed question is "
            "correct, partially correct, or incorrect."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "question": {"type": "string"},
                "student_answer": {"type": "string"},
                "expected_answer": {"type": "string"},
                "language": {"type": "string", "enum": ["en", "ar"]},
            },
            "required": ["question", "student_answer", "expected_answer"],
        },
    },
    {
        "name": "generate_next_hint",
        "description": (
            "Generate a hint for a stuck student. Use hint_level=1 first, "
            "escalate to 2 then 3 only if still stuck."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "problem": {
                    "type": "string",
                    "description": "The exercise or word the student is stuck on.",
                },
                "hint_level": {
                    "type": "integer",
                    "minimum": 1,
                    "maximum": 3,
                    "description": "1=subtle, 2=partial, 3=full explanation.",
                },
                "language": {"type": "string", "enum": ["en", "ar"]},
            },
            "required": ["problem", "hint_level"],
        },
    },
    {
        "name": "build_session_recap",
        "description": (
            "Build a structured end-of-session summary. Call this when the "
            "student says goodbye or signals they want to finish."
        ),
        "parameters": {
            "type": "object",
            "properties": {
                "session_id": {"type": "string"},
                "topics": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Topics or vocabulary areas covered.",
                },
                "mistakes": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Incorrect student answers recorded.",
                },
                "corrections": {
                    "type": "array",
                    "items": {"type": "string"},
                    "description": "Corrections provided during the session.",
                },
            },
            "required": ["session_id"],
        },
    },
]


class TutorAgent:
    def __init__(self) -> None:
        self._system_prompt: str = _PROMPT_FILE.read_text(encoding="utf-8")
        self._events: list[dict] = []  # accumulated tool call history

    @property
    def system_prompt(self) -> str:
        return self._system_prompt

    # ── Gemini config ──────────────────────────────────────────────────────────

    def build_live_config(self):
        """
        Returns a types.LiveConnectConfig with the system prompt, voice, and
        tool declarations. Called once when opening the Gemini Live session.
        """
        from google.genai import types

        tools = [
            types.Tool(
                function_declarations=[
                    types.FunctionDeclaration(**schema) for schema in _TOOL_SCHEMAS
                ]
            )
        ]

        return types.LiveConnectConfig(
            response_modalities=["AUDIO"],
            system_instruction=types.Content(
                parts=[types.Part(text=self._system_prompt)],
                role="user",
            ),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Charon"
                    )
                )
            ),
            tools=tools,
        )

    # ── Tool dispatch ──────────────────────────────────────────────────────────

    async def dispatch_tool_calls(self, tool_call) -> list[dict]:
        """
        Receive a Gemini tool_call object, run the matching local function,
        record the event, and return results as plain dicts.

        Returns:
            list of {"name": str, "result": dict}
        """
        results = []
        for fn_call in tool_call.function_calls:
            name = fn_call.name
            args = dict(fn_call.args)
            logger.info("Tool call: %s(%s)", name, args)

            if name in _TOOL_REGISTRY:
                result = _TOOL_REGISTRY[name](**args)
            else:
                result = {"error": f"Unknown tool: {name}"}
                logger.warning("Unknown tool requested by Gemini: %s", name)

            self._events.append({"tool": name, "args": args, "result": result})
            results.append({"name": name, "result": result})

        return results

    # ── Recap ──────────────────────────────────────────────────────────────────

    def build_recap(self, config: SessionConfig) -> SessionRecap:
        """
        Build an end-of-session recap from accumulated tool-call events.
        Called by session_manager after the audio bridge closes.
        """
        topics = list(
            {
                t
                for e in self._events
                if e.get("tool") == "build_session_recap"
                for t in e.get("args", {}).get("topics", [])
            }
        )
        mistakes = [
            e["args"].get("student_answer", "")
            for e in self._events
            if e.get("tool") == "check_answer"
            and e.get("result", {}).get("verdict") == "incorrect"
        ]
        corrections = [
            e["result"].get("correction", "")
            for e in self._events
            if e.get("tool") == "check_answer"
            and e.get("result", {}).get("correction")
        ]

        score = max(0.0, round(1.0 - len(mistakes) * 0.1, 2))

        return SessionRecap(
            session_id=config.session_id,
            duration_seconds=0.0,  # TODO: wire up real timing
            topics_covered=[t for t in topics if t],
            mistakes=mistakes,
            corrections=corrections,
            score=min(score, 1.0),
            summary=f"Session {config.session_id} complete.",
        )
