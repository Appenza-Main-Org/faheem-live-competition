"""
Tool: check_answer

Verifies whether a student's math answer is correct, partially correct,
or incorrect using normalised string comparison.
"""

from app.models.schemas import AnswerVerdict


def run(
    question: str,
    student_answer: str,
    expected_answer: str,
) -> dict:
    """
    Args:
        question:        The math question that was posed to the student.
        student_answer:  What the student said or typed.
        expected_answer: The correct answer.

    Returns:
        dict with keys: verdict, correction, explanation
    """
    s = student_answer.strip().lower()
    e = expected_answer.strip().lower()

    if s == e:
        verdict = AnswerVerdict.CORRECT
        correction = None
        explanation = "Correct!"
    elif e in s or s in e:
        verdict = AnswerVerdict.PARTIAL
        correction = expected_answer
        explanation = f"Almost — the exact answer is: {expected_answer}"
    else:
        verdict = AnswerVerdict.INCORRECT
        correction = expected_answer
        explanation = f"Not quite. The correct answer is: {expected_answer}"

    return {
        "verdict": verdict.value,
        "correction": correction,
        "explanation": explanation,
    }
