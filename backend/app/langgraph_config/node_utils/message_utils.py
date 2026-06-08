import json
from typing import Any, Dict, List

###### Helper functions to normalize and prepare state data for LLM prompting, 
# ensuring consistent formatting and handling of edge cases like missing or malformed data

def normalize_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, indent=2)
    return str(value).strip()


def normalize_history(chat_history: Any) -> List[Dict[str, str]]:
    if not isinstance(chat_history, list):
        return []

    normalized = []
    for item in chat_history:
        if not isinstance(item, dict):
            continue

        role = str(item.get("role", "")).strip()
        content = normalize_text(item.get("content", ""))

        if role in {"system", "user", "assistant"} and content:
            normalized.append({"role": role, "content": content})

    return normalized


def get_recent_history(chat_history: Any, max_turns: int = 6) -> List[Dict[str, str]]:
    normalized = normalize_history(chat_history)
    if max_turns <= 0:
        return []
    return normalized[-(max_turns * 2):]


def truncate_text(value: Any, max_chars: int) -> str:
    text = normalize_text(value)
    if max_chars <= 0:
        return ""
    if len(text) <= max_chars:
        return text
    suffix = "\n...[truncated]"
    keep = max(0, max_chars - len(suffix))
    return text[:keep].rstrip() + suffix


def compact_schema_summary(value: Any, max_columns: int = 18, max_chars: int = 3500) -> str:
    text = normalize_text(value)
    if not text:
        return ""

    try:
        payload = json.loads(text)
    except Exception:
        return truncate_text(text, max_chars)

    columns = payload.get("columns", [])
    compact_columns = []
    for col in columns[:max_columns]:
        if not isinstance(col, dict):
            continue
        compact_columns.append(
            {
                "column": col.get("column"),
                "dtype": col.get("dtype"),
                "sample": (col.get("sample_values") or [None])[0],
            }
        )

    compact_payload = {
        "row_count": payload.get("row_count"),
        "column_count": payload.get("column_count"),
        "columns": compact_columns,
    }

    if len(columns) > max_columns:
        compact_payload["truncated_columns"] = len(columns) - max_columns

    compact_text = json.dumps(compact_payload, ensure_ascii=False, indent=2)
    return truncate_text(compact_text, max_chars)


def compact_table_preview(value: Any, max_chars: int = 2500) -> str:
    return truncate_text(value, max_chars)


def compact_guidance(value: Any, max_chars: int = 1800, max_lines: int = 20) -> str:
    text = normalize_text(value)
    if not text:
        return ""

    lines = [line.rstrip() for line in text.splitlines() if line.strip()]
    compact = "\n".join(lines[:max_lines])
    return truncate_text(compact, max_chars)


def get_recent_history_for_prompt(
    chat_history: Any,
    max_turns: int = 3,
    max_total_chars: int = 2000,
    max_message_chars: int = 500,
) -> List[Dict[str, str]]:
    normalized = get_recent_history(chat_history, max_turns=max_turns)
    if not normalized:
        return []

    trimmed: List[Dict[str, str]] = []
    for item in normalized:
        trimmed.append(
            {
                "role": item["role"],
                "content": truncate_text(item.get("content", ""), max_message_chars),
            }
        )

    while trimmed and sum(len(m["content"]) for m in trimmed) > max_total_chars:
        trimmed.pop(0)

    return trimmed
