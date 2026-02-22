"""Chatbot safety: prompt injection, prompt leaking, input/output sanitization."""

import re

# Max lengths
MAX_USER_INPUT_LEN = 4000
MAX_RESPONSE_LEN = 8000

# Phrases that suggest prompt injection (user trying to override system behavior)
INJECTION_PATTERNS = [
    r"ignore\s+(all\s+)?(previous|above|prior)\s+instructions",
    r"disregard\s+(all\s+)?(previous|above|prior)",
    r"forget\s+(everything|all)\s+(you|your)\s+(were|are)",
    r"you\s+are\s+now\s+",
    r"new\s+instructions?\s*:",
    r"system\s*:\s*",
    r"\[system\]",
    r"<system>",
    r"reveal\s+(your\s+)?(system\s+)?(prompt|instructions)",
    r"repeat\s+(your\s+)?(system\s+)?(prompt|instructions)",
    r"what\s+are\s+your\s+(system\s+)?(instructions|prompt)",
    r"output\s+(your\s+)?(system\s+)?(prompt|instructions)",
    r"pretend\s+you\s+are",
    r"act\s+as\s+if\s+you\s+are",
    r"from\s+now\s+on\s+you\s+",
    r"your\s+new\s+role\s+is",
]

# Response content that indicates possible prompt leakage (system instruction echoed)
LEAKAGE_PATTERNS = [
    r"^You\s+are\s+the\s+Day\s+Planner",
    r"SYSTEM_INSTRUCTION",
    r"CRITICAL\s+—\s+Use\s+the\s+context",
]

_compiled_injection = [re.compile(p, re.I) for p in INJECTION_PATTERNS]
_compiled_leakage = [re.compile(p, re.I) for p in LEAKAGE_PATTERNS]


def sanitize_user_input(message: str, max_len: int = MAX_USER_INPUT_LEN) -> str:
    """
    Sanitize user input: truncate length and redact obvious prompt-injection phrases.
    Returns cleaned string; does not mutate original.
    """
    if not message or not isinstance(message, str):
        return ""
    text = message.strip()
    if len(text) > max_len:
        text = text[:max_len] + " [truncated]"
    for pat in _compiled_injection:
        text = pat.sub("[redacted]", text)
    return text


def wrap_user_message(sanitized: str) -> str:
    """Wrap user content in clear delimiters so the model treats it as user-only content."""
    return f"---USER MESSAGE---\n{sanitized}\n---END USER MESSAGE---"


def filter_response_leakage(response: str, max_len: int = MAX_RESPONSE_LEN) -> str:
    """
    Reduce prompt leaking: strip leading leakage phrases and truncate length.
    Returns safe response string.
    """
    if not response or not isinstance(response, str):
        return ""
    text = response.strip()
    for pat in _compiled_leakage:
        text = pat.sub("", text).strip()
    if len(text) > max_len:
        text = text[:max_len] + "\n[Response truncated.]"
    return text
