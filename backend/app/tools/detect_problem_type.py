"""
Tool: detect_problem_type

Classifies the type of language problem a student is experiencing.

Placeholder implementation: always returns UNKNOWN with zero confidence.
Wire up heuristics or a Gemini text call here in a future iteration.
"""

from app.models.schemas import ProblemType


def run(utterance: str, context: str = "") -> dict:
    """
    Args:
        utterance: The student's spoken or typed input.
        context:   Optional surrounding conversation context.

    Returns:
        dict with keys: problem_type, confidence, reasoning
    """
    # TODO: Replace with pattern matching or a Gemini classify call.
    return {
        "problem_type": ProblemType.UNKNOWN.value,
        "confidence": 0.0,
        "reasoning": "Placeholder — classification not yet implemented.",
    }
