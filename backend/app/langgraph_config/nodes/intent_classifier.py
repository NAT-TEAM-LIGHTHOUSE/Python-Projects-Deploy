import json
from typing import Any, Dict
import time
from app.langgraph_config.state.state import State
from app.llm.get_llm import GlobalLLM
from app.components.prompt_loader import GlobalPromptLoader
from utils.logger import get_logger
from utils.configure import main_logger, debug_logger, load_config
from app.langgraph_config.node_utils.json_loads import extract_json_block
from app.langgraph_config.node_utils.stage_labels import stage_update
from app.langgraph_config.node_utils.message_utils import (
    normalize_text,
    normalize_history,
    get_recent_history_for_prompt,
    compact_schema_summary,
    compact_table_preview,
    compact_guidance,
)
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation

logger = get_logger("langgraph.nodes.intent_classifier")

llm = GlobalLLM(llm_service="openai", model="gpt-4o-mini")

prompt_loader = GlobalPromptLoader()

################# INTENT CLASSIFIER NODE: CLASSIFIES USER QUERY INTO INTENT CATEGORIES (E.G. QA VS ANALYSIS) BASED ON USER QUERY AND DATA CONTEXT #################
def intent_classifier_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "intent_classifier")
    
    logger.info("====== [INTENT CLASSIFIER] Initialized LLM for Intent Classifier Node ======")
    start_time = time.time()
    
    main_logger.info(f"[INTENT CLASSIFIER] Starting intent classification")
    user_query = normalize_text(state.get("user_query") or "").strip()
    schema_summary = compact_schema_summary(state.get("schema_summary", ""), max_columns=16, max_chars=2200)
    table_preview = compact_table_preview(state.get("table_preview", ""), max_chars=1000)
    table_info = normalize_text(state.get("table_info", ""))
    custom_prompt = compact_guidance(state.get("custom_prompt"), max_chars=1200, max_lines=16)
    ai_prompt = compact_guidance(state.get("ai_prompt"), max_chars=4000, max_lines=100)
    chat_history = normalize_history(state.get("chat_history", []))
    recent_history = get_recent_history_for_prompt(
        chat_history,
        max_turns=2,
        max_total_chars=1200,
        max_message_chars=300,
    )

    prompt_template = prompt_loader.get_prompt("intent_prompt.txt")

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
            "content": (
                "You are the Intent Classifier for Table-GPT. "
                "Use the current user query, recent conversation, schema summary, table preview, "
                "table info, custom prompt, and AI prompt to classify the request. "
                "If the current turn is a follow-up like 'now top 5', 'same but only active', "
                "'exclude nulls', 'what about this', or similar, use recent conversation to preserve intent continuity. "
                "Return only valid JSON in the requested format."
            ),
        },
        *recent_history,
        {
            "role": "user",
            "content": prompt,
        },
    ]

    response = llm.get_response(messages)
    parsed = extract_json_block(response)

    intent = str(parsed.get("intent", "qa")).strip().lower()
    intent_reason = str(parsed.get("reason", "")).strip()

    if intent not in {"qa", "analysis"}:
        intent = "qa"
        
    logger.info(f"[INTENT CLASSIFIER] Classified intent: {intent} (Reason: {intent_reason})")
    main_logger.info(f"[INTENT CLASSIFIER] Completed intent classification with intent: {intent} and reason: {intent_reason}")
    elapse_time = time.time() - start_time
    logger.info("============= Completed Intent Classification ============= time_taken=%.3fs",elapse_time)
    return {
        **stage_update("intent_classifier"),
        "intent": intent,
        "intent_reason": intent_reason,
        "status": "intent_classified",
    }
