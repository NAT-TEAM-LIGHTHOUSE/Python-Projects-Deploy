import re

def _clean_generated_code(text: str) -> str:
    code = (text or "").strip()
    if not code:
        return ""

    fenced_blocks = re.findall(r"```(?:python|py)?\s*(.*?)```", code, flags=re.IGNORECASE | re.DOTALL)
    candidates = []
    if fenced_blocks:
        candidates.append("\n\n".join(block.strip() for block in fenced_blocks if block.strip()))

    candidates.append("\n".join(line for line in code.splitlines() if not line.strip().startswith("```")).strip())
    candidates.append(code)

    for candidate in candidates:
        if not candidate:
            continue
        try:
            compile(candidate, "<generated_code>", "exec")
            return candidate
        except SyntaxError:
            continue

    return candidates[0] if candidates else code