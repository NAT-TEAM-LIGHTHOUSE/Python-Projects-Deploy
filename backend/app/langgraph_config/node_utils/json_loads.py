import json
from typing import Any, Dict

def safe_json_loads(text: str) -> Dict[str, Any]:
    try:
        return json.loads(text)
    except Exception:
        return {}


def extract_json_block(text: str) -> Dict[str, Any]:
    text = (text or "").strip()

    parsed = safe_json_loads(text)
    if parsed:
        return parsed

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1 and end > start:
        parsed = safe_json_loads(text[start:end + 1])
        if parsed:
            return parsed

    return {}