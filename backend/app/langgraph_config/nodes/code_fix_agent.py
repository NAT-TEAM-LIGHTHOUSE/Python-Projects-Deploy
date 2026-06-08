from typing import Any, Dict
import re
import time
from app.langgraph_config.state.state import State
from app.llm.get_llm import GlobalLLM
from app.components.prompt_loader import GlobalPromptLoader
from app.langgraph_config.node_utils.stage_labels import stage_update
from app.langgraph_config.node_utils.message_utils import (
    normalize_text,
    normalize_history,
    get_recent_history_for_prompt,
    compact_schema_summary,
    compact_table_preview,
    compact_guidance,
    truncate_text,
)
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation
from utils.logger import get_logger
from utils.configure import main_logger, debug_logger, load_config
from ..node_utils.clean_generated_code import _clean_generated_code

logger = get_logger("langgraph.nodes.code_fix_agent")

llm = GlobalLLM(llm_service="anthropic", model="claude-haiku-4-5")
prompt_loader = GlobalPromptLoader()

CODE_FIX_SYSTEM_PROMPT = """
You are the Code Fix Agent for Table-GPT.

Fix the previously generated Python pandas code so it executes successfully.

Rules:
- Return only corrected Python code.
- Do not wrap code in markdown fences.
- Preserve the user's intent.
- Do not invent columns that are not present in the schema.
- The dataset path will be available in a variable named DATASET_PATH.
- Do not use unsafe operations, shell commands, subprocesses, network access, file deletion, or plotting libraries.
- Use recent conversation context when the current request is a follow-up.
""".strip()

#### Get the code fix prompt template
def _get_fix_prompt() -> str:
    try:
        return prompt_loader.get_prompt("fix_prompt.txt")
    except Exception:
        pass

############################### Code Fix Agent Node ###############################
def code_fix_agent_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "code_fix_agent")
    
    logger.info("================= [CODE FIX AGENT] Starting =================")
    start_time = time.time()
    user_query = (state.get("user_query") or "").strip()
    plan = truncate_text(state.get("plan", ""), 2200)
    schema_summary = compact_schema_summary(state.get("schema_summary", ""), max_columns=14, max_chars=1600)
    table_preview = compact_table_preview(state.get("table_preview", ""), max_chars=700)
    custom_prompt = compact_guidance(state.get("custom_prompt", ""), max_chars=900, max_lines=12)
    ai_prompt = compact_guidance(state.get("ai_prompt", ""), max_chars=4000, max_lines=100)
    generated_code = truncate_text(state.get("generated_code", ""), 8000)
    execution_error = truncate_text(state.get("execution_error", ""), 3000)
    chat_history = normalize_history(state.get("chat_history", []))
    recent_history = get_recent_history_for_prompt(
        chat_history,
        max_turns=1,
        max_total_chars=500,
        max_message_chars=250,
    )
    retry_count = int(state.get("retry_count", 0))

    prompt_template = _get_fix_prompt()
    user_prompt = prompt_template.format(
        user_query=user_query,
        plan=plan,
        schema_summary=schema_summary,
        table_preview=table_preview,
        custom_prompt=custom_prompt,
        ai_prompt=ai_prompt,
        generated_code=generated_code,
        execution_error=execution_error,
    )

    messages = [
        {"role": "system", "content": CODE_FIX_SYSTEM_PROMPT},
        *recent_history,
        {"role": "user", "content": user_prompt},
    ]

    logger.info(f"[CODE FIX AGENT] Invoking LLM to fix code. Current retry_count={retry_count}")
    fixed_code = _clean_generated_code(llm.get_response(messages))
        
    logger.info(f"[CODE FIX AGENT] Fixed code received from LLM: {fixed_code}")
    main_logger.info(f"[CODE FIX AGENT] Fixed Python Code received: \n{fixed_code}")
    elapsed_time = time.time() - start_time
    logger.info("================= [CODE FIX AGENT] Completed ================= time_taken=%.3fs",elapsed_time,)
    
    return {
        **stage_update("code_fix_agent"),
        "generated_code": fixed_code,
        "retry_count": retry_count + 1,
        "status": "code_fixed",
    }
