from __future__ import annotations

import uuid
from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class MathProblemType(str, Enum):
    ALGEBRA = "algebra"
    GEOMETRY = "geometry"
    ARITHMETIC = "arithmetic"
    CALCULUS = "calculus"
    STATISTICS = "statistics"
    TRIGONOMETRY = "trigonometry"
    WORD_PROBLEM = "word_problem"
    UNKNOWN = "unknown"


class HintLevel(int, Enum):
    SUBTLE = 1    # minimal nudge
    MODERATE = 2  # partial reveal
    DIRECT = 3    # full explanation


class AnswerVerdict(str, Enum):
    CORRECT = "correct"
    PARTIAL = "partial"
    INCORRECT = "incorrect"


class SessionConfig(BaseModel):
    session_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ToolCall(BaseModel):
    tool_name: str
    arguments: dict[str, Any]


class ToolResult(BaseModel):
    tool_name: str
    result: dict[str, Any]
    error: str | None = None


class SessionEvent(BaseModel):
    session_id: str
    event_type: str  # "tool_call" | "audio_in" | "audio_out" | "error"
    payload: dict[str, Any] = Field(default_factory=dict)
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class SessionRecap(BaseModel):
    session_id: str
    duration_seconds: float
    topics_covered: list[str]
    mistakes: list[str]
    corrections: list[str]
    score: float = Field(ge=0.0, le=1.0, default=0.0)
    summary: str
