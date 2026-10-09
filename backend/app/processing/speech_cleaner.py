"""
Speech and Transcript Cleaner.
Strips spoken conversational artifacts, verbal disfluencies, YouTube/media intros/outros,
and channel hooks, transforming raw transcript text into clean, formal academic text.
"""

import re
from typing import List

# Patterns for spoken greetings, filler phrases, and channel fluff (case-insensitive)
SPEECH_PATTERNS = [
    # Intros / Greetings
    r"\b(hey|hello|hi|what's up|yo)\s+(everyone|everybody|guys|folks|all|viewers|students)\b[,.!]?",
    r"\bwelcome\s+(back\s+)?(to\s+(my|the|our)\s+(channel|video|lecture|stream|class|tutorial))\b[,.!]?",
    r"\bwelcome\s+back[,.!]?",
    r"\bin\s+this\s+(video|tutorial|lecture|session)\s+(we('re|\s+are)\s+going\s+to|we\s+will|we'll)\s+(talk\s+about|discuss|cover|learn|look\s+at)[^.!?]*[.!?]?",
    r"\btoday\s+(we('re|\s+are)\s+going\s+to|we\s+will|we'll)\s+(talk\s+about|discuss|cover|learn|look\s+at)[^.!?]*[.!?]?",
    r"\bso\s+today\s+(we('re|\s+are)\s+going\s+to|we\s+will|we'll)[^.!?]*[.!?]?",
    # Outros & Channel CTAs
    r"\bmake\s+sure\s+to\s+(like|subscribe|share|comment|hit\s+the\s+bell)\b[^.!?]*[.!?]?",
    r"\b(don't\s+forget\s+to|please)\s+(like|subscribe|leave\s+a\s+comment)[^.!?]*[.!?]?",
    r"\b(thanks\s+for\s+watching|thank\s+you\s+for\s+watching|thank\s+you\s+very\s+much|thank\s+you\s+guys)[^.!?]*[.!?]?",
    r"\bsee\s+you\s+(in\s+the\s+next\s+(video|lecture|one)|next\s+time)[^.!?]*[.!?]?",
    r"\bhit\s+the\s+(like|subscribe|bell)\s+button[^.!?]*[.!?]?",
    # Common conversational disfluencies / verbal tics
    r"\b(um|uh|erm|uhm|hmm)\b[,.]?",
    r"\b(you\s+know\s+what\s+i\s+mean|you\s+know|like\s+basically|basically\s+speaking|as\s+you\s+know)\b[,.]?",
    r"\b(okay\s+so|alright\s+so|so\s+basically|now\s+basically)\b[,.]?",
    r"\b(let('s|\s+us)\s+get\s+started|without\s+further\s+ado)\b[,.!]?",
    r"\bas\s+i\s+(said|mentioned)\s+(earlier|before)\b[,.]?",
    r"\bas\s+you\s+can\s+see\s+(here|on\s+the\s+screen)\b[,.]?",
]

COMPILED_PATTERNS = [re.compile(p, re.IGNORECASE) for p in SPEECH_PATTERNS]


def clean_transcript_speech(text: str) -> str:
    """
    Cleans conversational fillers, greetings, outros, and verbal tics from spoken transcripts.
    Preserves all technical definitions, facts, equations, and academic concepts.
    """
    if not text:
        return ""

    cleaned = text
    for pat in COMPILED_PATTERNS:
        cleaned = pat.sub("", cleaned)

    # Clean up double punctuation or awkward whitespace
    cleaned = re.sub(r"\s+", " ", cleaned).strip()
    cleaned = re.sub(r"^[,\s;:-]+", "", cleaned).strip()
    cleaned = re.sub(r"\s+([,.?!])", r"\1", cleaned)
    cleaned = re.sub(r"([,.?!]){2,}", r"\1", cleaned)

    # Ensure capitalized start
    if cleaned and cleaned[0].islower():
        cleaned = cleaned[0].upper() + cleaned[1:]

    return cleaned


def clean_academic_sentence(sentence: str) -> str:
    """
    Specifically cleans a single sentence for use in flashcards, assessment stems, or notes.
    Removes introductory conversational discourse markers and formats clean academic text.
    """
    if not sentence:
        return ""
    cleaned = clean_transcript_speech(sentence)
    # Remove leading connective speech words like "So, ", "And, ", "Now, ", "Well, ", "Okay, "
    cleaned = re.sub(
        r"^(?:(?:so|and|now|well|okay|alright|first\s+of\s+all|moving\s+on)\s*,\s*)+",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    if cleaned and cleaned[0].islower():
        cleaned = cleaned[0].upper() + cleaned[1:]
    return cleaned
