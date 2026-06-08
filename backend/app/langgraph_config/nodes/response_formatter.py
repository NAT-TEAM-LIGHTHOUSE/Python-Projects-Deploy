from typing import Any, Dict
import time
import json
from app.langgraph_config.state.state import State
from app.llm.get_llm import GlobalLLM
from app.components.prompt_loader import GlobalPromptLoader
from app.langgraph_config.node_utils.message_utils import normalize_text, normalize_history
from app.langgraph_config.node_utils.stage_labels import stage_update
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation
from utils.logger import get_logger
from utils.configure import main_logger, debug_logger, load_config

logger = get_logger("langgraph.nodes.response_formatter")

llm = GlobalLLM(llm_service="openai", model="gpt-4.1-nano")
prompt_loader = GlobalPromptLoader()

RESPONSE_FORMATTER_SYSTEM_PROMPT = """
You are the Final Response Formatter for Table-GPT.

Your job is to convert execution results into a clear, user-friendly final answer.

Rules:
- If the result is already structured tabular text, it should not be reformatted here.
- For non-tabular output, explain the result clearly and concisely.
- Do not invent values not present in the execution result.
- Do not mention internal implementation details like Python, pandas, code generation, or sandbox execution unless the result is an error.
- Keep the answer focused on the user's request.
""".strip()

def _is_html_table(text: str) -> bool:
    if not text:
        return False

    lowered = text.lower()
    return (
        "<table" in lowered
        and "</table>" in lowered
        and "<tr" in lowered
        and ("<td" in lowered or "<th" in lowered)
    )

### Helper function to load the response formatter prompt template.
def _get_formatter_prompt() -> str:
    try:
        return prompt_loader.get_prompt("response_formatter_prompt.txt")
    except Exception:
        logger.warning("[RESPONSE FORMATTER] Failed to load custom prompt. Using default.")
        return ""

######################## Response Formatter Node ########################
def response_formatter_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "response_formatter")
    
    logger.info("================= [RESPONSE FORMATTER] Starting =================")
    start_time = time.time()

    user_query = (state.get("user_query") or "").strip()
    plan = (state.get("plan") or "").strip()
    execution_output = (state.get("execution_output") or "").strip()
    execution_error = (state.get("execution_error") or "").strip()
    chat_history = normalize_history(state.get("chat_history", []))
    
    # Get visualization data if available
    has_visualization = state.get("has_visualization", False)
    visualization_spec = state.get("visualization_spec", {})

    if execution_error:
        final_answer = f"Unable to complete the analysis.\n{execution_error}"
        updated_history = chat_history + [
            {"role": "user", "content": user_query},
            {"role": "assistant", "content": final_answer},
        ]
        logger.info("[RESPONSE FORMATTER] Returning execution error directly.")
        main_logger.info(f"[RESPONSE FORMATTER] Returning execution error directly")
        logger.info("================= [RESPONSE FORMATTER] Completed =================")
        return {
            **stage_update("response_formatter"),
            "final_answer": final_answer,
            "chat_history": updated_history,
            "status": "completed",
            "visualization_spec": visualization_spec if has_visualization else {},
            "has_visualization": has_visualization,
        }

    if not execution_output:
        final_answer = "No result was produced for the request."
        updated_history = chat_history + [
            {"role": "user", "content": user_query},
            {"role": "assistant", "content": final_answer},
        ]
        logger.info("[RESPONSE FORMATTER] No execution output found. Returning fallback response.")
        main_logger.info(f"[RESPONSE FORMATTER] No execution output found. Returning fallback response")
        logger.info("================= [RESPONSE FORMATTER] Completed =================")
        return {
            **stage_update("response_formatter"),
            "final_answer": final_answer,
            "chat_history": updated_history,
            "status": "completed",
            "visualization_spec": visualization_spec if has_visualization else {},
            "has_visualization": has_visualization,
        }

    if _is_html_table(execution_output):
        final_answer = execution_output
        updated_history = chat_history + [
            {"role": "user", "content": user_query},
            {"role": "assistant", "content": final_answer},
        ]
        logger.info("[RESPONSE FORMATTER] HTML table output detected. Returning directly without LLM.")
        main_logger.info(f"[RESPONSE FORMATTER] HTML table output detected. Returning directly without LLM. Output: \n{final_answer[:500]}..." if len(final_answer) > 500 else final_answer)
        logger.info("================= [RESPONSE FORMATTER] Completed =================")
        return {
            **stage_update("response_formatter"),
            "final_answer": final_answer,
            "chat_history": updated_history,
            "status": "completed",
            "visualization_spec": visualization_spec if has_visualization else {},
            "has_visualization": has_visualization,
        }

    prompt_template = _get_formatter_prompt()
    user_prompt = prompt_template.format(
        user_query=user_query,
        plan=plan,
        execution_output=execution_output,
    )

    messages = [
        {
            "role": "system",
            "content": RESPONSE_FORMATTER_SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": user_prompt,
        },
    ]

    logger.info("[RESPONSE FORMATTER] Non-tabular output detected. Invoking LLM formatter.")
    final_answer = llm.get_response(messages).strip()
    updated_history = chat_history + [
        {"role": "user", "content": user_query},
        {"role": "assistant", "content": final_answer},
    ]
    final_answer_preview = final_answer[:200] + "..." if len(final_answer) > 200 else final_answer
    logger.info("[RESPONSE FORMATTER] Final answer generated by LLM: " + final_answer_preview)
    main_logger.info(f"[RESPONSE FORMATTER] Final answer generated by LLM: \n{final_answer_preview}")
    elapsed_time = time.time() - start_time
    logger.info("================= [RESPONSE FORMATTER] Completed =================, time_taken=%.3fs",elapsed_time)
    
    # Build response with visualization if available
    response = {
        **stage_update("response_formatter"),
        "final_answer": final_answer,
        "chat_history": updated_history,
        "status": "completed",
        "visualization_spec": visualization_spec if has_visualization else {},
        "has_visualization": has_visualization,
    }
    
    if has_visualization:
        logger.info("[RESPONSE FORMATTER] Including visualization in response.")
        main_logger.info(f"[RESPONSE FORMATTER] Visualization included in response.")

    return response
