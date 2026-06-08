from typing import Any, Dict
import time
from app.langgraph_config.state.state import State
from app.llm.get_llm import GlobalLLM
from app.components.prompt_loader import GlobalPromptLoader
from app.langgraph_config.node_utils.message_utils import (
    normalize_text,
    get_recent_history_for_prompt,
    compact_schema_summary,
    compact_table_preview,
    compact_guidance,
)
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation
from utils.logger import get_logger
from utils.configure import main_logger, debug_logger, load_config
from app.langgraph_config.node_utils.stage_labels import stage_update

logger = get_logger("langgraph.nodes.query_planner")

# Using Anthropic's Haiku for blazing fast speed and strict instruction adherence during schema mapping
llm = GlobalLLM(llm_service="anthropic", model="claude-haiku-4-5")

prompt_loader = GlobalPromptLoader()

PLANNER_SYSTEM_PROMPT = """
You are the Query Planner for Table-GPT.

Your job is to convert the user's request into a precise analysis plan that can later be turned into Python pandas code.

Rules:
- Do not write Python code.
- Do not calculate the final answer yourself.
- Focus on the user's actual question.
- Use only the columns that exist in the provided schema and preview.
- Do not invent missing columns.
- Resolve business terms using AI Prompt and Custom Prompt mappings first, schema/table metadata second, and raw column names only as a fallback.
- When several columns appear related, select the column whose mapped business meaning matches the user's metric.
- If multiple candidate columns remain valid and the question is analytical, plan separate clearly labeled calculations for each relevant column so the user can compare interpretations.
- Ask for clarification only when multiple calculations would be misleading, impossible, or unrelated to the user's request.
- Keep the plan concise, execution-oriented, and step-by-step.
- Use recent conversation context when the current request is a follow-up.

Return only the plan as plain text.
""".strip()

##### Get the prompt template for the query planner #####
def _get_planner_prompt() -> str:
    try:
        return prompt_loader.get_prompt("planner_prompt.txt")
    except Exception:
        pass

######################################## Query Planner Node #######################
def query_planner_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "query_planner")
    
    logger.info("================= [QUERY PLANNER] Starting =================")
    start_time = time.time()
    main_logger.info(f"[QUERY PLANNER] Starting to generate analysis plan")

    user_query = (state.get("user_query") or "").strip()
    schema_summary = compact_schema_summary(state.get("schema_summary", ""), max_columns=18, max_chars=2600)
    table_preview = compact_table_preview(state.get("table_preview", ""), max_chars=1400)
    table_info = normalize_text(state.get("table_info", ""))
    custom_prompt = compact_guidance(state.get("custom_prompt", ""), max_chars=2600, max_lines=35)
    ai_prompt = compact_guidance(state.get("ai_prompt", ""), max_chars=4000, max_lines=100)
    recent_history = get_recent_history_for_prompt(
        state.get("chat_history", []),
        max_turns=3,
        max_total_chars=1800,
        max_message_chars=400,
    )

    dataset_available = state.get("dataset_available", False)
    table_file_path = state.get("table_file_path", "")

    if not dataset_available:
        logger.warning("[QUERY PLANNER] Dataset not available.")
        return {
            "plan": "",
            "status": "error",
            "error_message": "Dataset not available for planning.",
            "final_answer": "No dataset found for this session. Please send table data first.",
        }

    if not table_file_path:
        logger.warning("[QUERY PLANNER] table_file_path missing.")
        return {
            "plan": "",
            "status": "error",
            "error_message": "Dataset file path missing for planning.",
            "final_answer": "Dataset file path is missing, so planning cannot continue.",
        }

    prompt_template = _get_planner_prompt()
    prompt = prompt_template.format(
        user_query=user_query,
        schema_summary=schema_summary,
        table_preview=table_preview,
        table_info=table_info,
        custom_prompt=custom_prompt,
        ai_prompt=ai_prompt,
    )

    messages = [
        {
            "role": "system",
            "content": PLANNER_SYSTEM_PROMPT,
        },
        *recent_history,
        {
            "role": "user",
            "content": prompt,
        },
    ]

    logger.info("[QUERY PLANNER] Invoking LLM for analysis planning.")
    plan = llm.get_response(messages)

    logger.info(f"[QUERY PLANNER] Plan generated: {str(plan)[:500]}...")
    main_logger.info(f"[QUERY PLANNER] Plan generated successfully: \n{plan}")
    elapsed_time = time.time() - start_time
    logger.info("===================== [QUERY PLANNER] Planning completed successfully. =====================, time_taken=%.3fs",elapsed_time,)

    return {
        **stage_update("query_planner"),
        "plan": plan,
        "status": "plan_ready",
        "error_message": "",
    }
