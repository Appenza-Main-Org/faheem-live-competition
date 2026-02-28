"""
Tool: generate_next_hint

Generates a progressively more revealing hint for a stuck student.

Placeholder implementation: returns static template strings.
Wire up a Gemini text call to generate context-aware hints in production.
"""

from app.models.schemas import HintLevel


def run(problem: str, hint_level: int = 1, language: str = "en") -> dict:
    """
    Args:
        problem:    Description of the exercise or word the student is stuck on.
        hint_level: 1 = subtle nudge, 2 = partial reveal, 3 = full explanation.
        language:   "en" or "ar" — for future localised hints.

    Returns:
        dict with keys: hint, hint_level, language
    """
    level = HintLevel(min(max(hint_level, 1), 3))

    templates = {
        HintLevel.SUBTLE: "Think about the root of the word and its related family.",
        HintLevel.MODERATE: f"The answer is closely related to: {problem[:30]}...",
        HintLevel.DIRECT: f"Here is the full answer: {problem}",
    }

    return {
        "hint": templates[level],
        "hint_level": level.value,
        "language": language,
    }
