import json
from typing import Any, Dict

from app.langgraph_config.state.state import State
from app.llm.get_llm import GlobalLLM

llm = GlobalLLM(llm_service="anthropic", model="claude-sonnet-4-5")

def _normalize_prompt(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value.strip()
    if isinstance(value, (dict, list)):
        return json.dumps(value, ensure_ascii=False, indent=2)
    return str(value).strip()


def basic_chatbot_node(state: State) -> Dict[str, Any]:
    user_query = (state.get("user_query") or "").strip()
    chat_history = state.get("chat_history", [])
    llm_service = _normalize_prompt(state.get("llm_service"))
    llm_model = _normalize_prompt(state.get("llm_model"))

    schema_summary = state.get("schema_summary", "")
    table_preview = state.get("table_preview", "")
    table_info = _normalize_prompt(state.get("table_info"))
    ai_prompt = _normalize_prompt(state.get("ai_prompt"))
    custom_prompt = _normalize_prompt(state.get("custom_prompt"))

    system_prompt = f"""
You are Table-GPT.

Answer the user using the provided dataset context.
Do not invent facts not supported by the dataset context.
If the user asks something not available in the data, say that clearly.

DATASET SCHEMA:
{schema_summary}

DATASET PREVIEW:
{table_preview}

TABLE INFO / METADATA:
{table_info}
""".strip()

    messages = [{"role": "system", "content": system_prompt}]

    if ai_prompt:
        messages.append(
            {
                "role": "system",
                "content": f"Additional AI instructions:\n{ai_prompt}",
            }
        )

    if custom_prompt:
        messages.append(
            {
                "role": "system",
                "content": f"Business rules / custom prompt:\n{custom_prompt}",
            }
        )

    messages.extend(chat_history)
    messages.append({"role": "user", "content": user_query})

    response_kwargs = {}
    if llm_service:
        response_kwargs["llm_service"] = llm_service
    if llm_model:
        response_kwargs["model"] = llm_model

    answer = llm.get_response(messages, **response_kwargs)

    updated_history = chat_history + [
        {"role": "user", "content": user_query},
        {"role": "assistant", "content": answer},
    ]

    return {
        "final_answer": answer,
        "chat_history": updated_history,
        "status": "completed",
    }
