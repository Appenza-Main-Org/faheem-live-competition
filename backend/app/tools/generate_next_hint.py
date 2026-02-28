"""
Tool: generate_next_hint

Generates a progressively more revealing hint for a student stuck
on a math problem.
"""

from app.models.schemas import HintLevel


def run(problem: str, hint_level: int = 1) -> dict:
    """
    Args:
        problem:    The math problem the student is stuck on.
        hint_level: 1 = strategy hint, 2 = partial step, 3 = full worked step.

    Returns:
        dict with keys: hint, hint_level
    """
    level = HintLevel(min(max(hint_level, 1), 3))

    templates = {
        HintLevel.SUBTLE: (
            f"Think about what operation or technique applies here. "
            f"What does the structure of '{problem[:50]}' remind you of?"
        ),
        HintLevel.MODERATE: (
            f"Start by identifying what you know and what you're solving for. "
            f"For '{problem[:50]}', try setting it up step by step — what's the first operation?"
        ),
        HintLevel.DIRECT: (
            f"Here's how to approach it: for '{problem[:80]}', "
            f"begin by isolating the unknown, apply the relevant formula or rule, "
            f"then simplify. Try working through it now."
        ),
    }

    return {
        "hint": templates[level],
        "hint_level": level.value,
    }
