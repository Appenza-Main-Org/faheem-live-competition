"""
Tool: build_session_recap

Produces a structured end-of-session summary.

Placeholder implementation: assembles a plain-English paragraph from inputs.
Wire up Firestore writes and richer summarisation in a future iteration.
"""


def run(
    session_id: str,
    topics: list[str] | None = None,
    mistakes: list[str] | None = None,
    corrections: list[str] | None = None,
) -> dict:
    """
    Args:
        session_id:  Unique session identifier.
        topics:      List of topics or vocabulary areas covered.
        mistakes:    List of incorrect student answers recorded.
        corrections: List of corrections provided by Faheem.

    Returns:
        dict with keys: session_id, topics_covered, mistakes, corrections,
                        summary, score
    """
    topics = topics or []
    mistakes = mistakes or []
    corrections = corrections or []

    lines = [f"Session {session_id} recap:"]
    if topics:
        lines.append(f"Topics covered: {', '.join(topics)}.")
    if mistakes:
        lines.append(f"Mistakes made: {len(mistakes)}.")
    if corrections:
        lines.append(f"Corrections provided: {len(corrections)}.")
    lines.append("Great work today!")

    score = max(0.0, round(1.0 - len(mistakes) * 0.1, 2))

    return {
        "session_id": session_id,
        "topics_covered": topics,
        "mistakes": mistakes,
        "corrections": corrections,
        "summary": " ".join(lines),
        "score": min(score, 1.0),
    }
