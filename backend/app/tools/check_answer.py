"""
Tool: check_answer

Verifies whether a student's answer is correct, partially correct, or incorrect.

Placeholder implementation: uses normalised string comparison.
Wire up semantic similarity or a Gemini grading call for production.
"""

from app.models.schemas import AnswerVerdict


def run(
    question: str,
    student_answer: str,
    expected_answer: str,
    language: str = "en",
) -> dict:
    """
    Args:
        question:        The question that was posed to the student.
        student_answer:  What the student said or typed.
        expected_answer: The correct answer.
        language:        "en" or "ar" — affects future normalisation logic.

    Returns:
        dict with keys: verdict, correction, explanation
    """
    s = student_answer.strip().lower()
    e = expected_answer.strip().lower()

    if s == e:
        verdict = AnswerVerdict.CORRECT
        correction = None
    elif e in s or s in e:
        verdict = AnswerVerdict.PARTIAL
        correction = expected_answer
    else:
        verdict = AnswerVerdict.INCORRECT
        correction = expected_answer

    return {
        "verdict": verdict.value,
        "correction": correction,
        "explanation": "Placeholder — semantic grading not yet implemented.",
    }
