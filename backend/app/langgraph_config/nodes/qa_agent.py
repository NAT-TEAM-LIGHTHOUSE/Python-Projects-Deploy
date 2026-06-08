from typing import Any, Dict, List
import time 
from app.langgraph_config.state.state import State
from app.llm.get_llm import GlobalLLM
from app.components.prompt_loader import GlobalPromptLoader
from app.langgraph_config.node_utils.message_utils import (
    normalize_text,
    normalize_history,
    get_recent_history_for_prompt,
    compact_schema_summary,
    compact_table_preview,
    compact_guidance,
)
from app.langgraph_config.node_utils.stage_labels import stage_update
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation
from utils.logger import get_logger
from utils.configure import main_logger, debug_logger, load_config

logger = get_logger("langgraph.nodes.qa_agent")

llm = GlobalLLM(llm_service="groq", model="llama-3.3-70b-versatile")

prompt_loader = GlobalPromptLoader()

### QA_SYSTEM_PROMPT
QA_SYSTEM_PROMPT = """
You are the Q&A Agent for Table-GPT.

Answer dataset-related user questions using the provided schema, preview, metadata, and recent conversation context.

Rules:
- Answer clearly and directly.
- Use conversation history when needed to resolve follow-up questions.
- Do not invent facts outside the available dataset context.
- Do not generate Python code.
- If the answer is not available from the provided context, say that clearly.
""".strip()


### Helper function to load the Q&A prompt template
def get_qa_prompt_template() -> str:
    """
    If qa_prompt.txt exists, use it.
    Otherwise fallback to inline prompt.
    """
    try:
        return prompt_loader.get_prompt("qa_prompt.txt")
    except Exception:
        pass

############# Q&A AGENT NODE: USES LLM TO ANSWER USER QUERY BASED ON INTENT, SCHEMA, PREVIEW, AND CUSTOM PROMPTS ############################
def qa_agent_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "qa_agent")
    
    logger.info("================= [Q&A AGENT] Starting Q&A agent =================")
    start_time = time.time()
    main_logger.info(f"[Q&A AGENT] Preparing to answer user query")
    
    user_query = normalize_text(state.get("user_query"))
    schema_summary = compact_schema_summary(state.get("schema_summary"), max_columns=20, max_chars=2800)
    table_preview = compact_table_preview(state.get("table_preview"), max_chars=1800)
    table_info = normalize_text(state.get("table_info"))
    custom_prompt = compact_guidance(state.get("custom_prompt"), max_chars=1400, max_lines=18)
    ai_prompt = compact_guidance(state.get("ai_prompt"), max_chars=4000, max_lines=100)
    chat_history = normalize_history(state.get("chat_history", []))
    recent_history = get_recent_history_for_prompt(
        chat_history,
        max_turns=4,
        max_total_chars=2200,
        max_message_chars=450,
    )

    prompt_template = get_qa_prompt_template()

    user_prompt  = prompt_template.format(
        user_query=user_query,
        schema_summary=schema_summary,
        table_preview=table_preview,
        table_info=table_info,
        custom_prompt=custom_prompt,
        ai_prompt=ai_prompt,
    )

    messages: List[Dict[str, str]] = [
        {"role": "system", "content": QA_SYSTEM_PROMPT},
        *recent_history,
        {"role": "user", "content": user_prompt},
    ]

    logger.info("Invoking Q&A agent LLM")
    answer = llm.get_response(messages)

    updated_history = chat_history + [
        {"role": "user", "content": user_query},
        {"role": "assistant", "content": answer},
    ]
    
    logger.info(f"[Q&A AGENT] Generated answer: {answer[:500]}...") 
    main_logger.info(f"[Q&A AGENT] Completed answering user query") 
    logger.info("================= [Q&A AGENT] Completed Q&A agent =================")
    elapsed_time = time.time() - start_time
    logger.info("============= Completed Q&A Agent ============= time_taken=%.3fs",elapsed_time)
    return {
        **stage_update("qa_agent"),
        "final_answer": answer,
        "chat_history": updated_history,
        "status": "completed",
    }
