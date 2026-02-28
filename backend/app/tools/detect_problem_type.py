"""
Tool: detect_problem_type

Classifies the type of math problem a student is working on using
keyword heuristics. Returns one of the MathProblemType values.
"""

from app.models.schemas import MathProblemType

_KEYWORDS: list[tuple[MathProblemType, list[str]]] = [
    (MathProblemType.CALCULUS,      ["derivative", "integral", "limit", "differentiate", "integrate", "calculus", "d/dx", "dy/dx"]),
    (MathProblemType.TRIGONOMETRY,  ["sin", "cos", "tan", "angle", "triangle", "unit circle", "radian", "degree", "hypotenuse"]),
    (MathProblemType.STATISTICS,    ["mean", "median", "mode", "probability", "distribution", "standard deviation", "variance", "sample"]),
    (MathProblemType.GEOMETRY,      ["area", "perimeter", "volume", "circle", "polygon", "rectangle", "square", "cube", "sphere", "proof"]),
    (MathProblemType.ALGEBRA,       ["equation", "solve", "variable", "factor", "polynomial", "quadratic", "linear", "system", "inequality"]),
    (MathProblemType.WORD_PROBLEM,  ["how many", "how much", "total", "if a train", "a store", "per hour", "in total", "word problem"]),
    (MathProblemType.ARITHMETIC,    ["add", "subtract", "multiply", "divide", "fraction", "decimal", "percent", "remainder", "times"]),
]


def run(utterance: str, context: str = "") -> dict:
    """
    Args:
        utterance: The student's spoken or typed math problem.
        context:   Optional surrounding conversation context.

    Returns:
        dict with keys: problem_type, confidence, reasoning
    """
    text = (utterance + " " + context).lower()

    for problem_type, keywords in _KEYWORDS:
        matched = [kw for kw in keywords if kw in text]
        if matched:
            return {
                "problem_type": problem_type.value,
                "confidence": min(0.5 + len(matched) * 0.1, 0.95),
                "reasoning": f"Matched keywords: {', '.join(matched)}",
            }

    return {
        "problem_type": MathProblemType.UNKNOWN.value,
        "confidence": 0.0,
        "reasoning": "No recognizable math keywords found.",
    }
