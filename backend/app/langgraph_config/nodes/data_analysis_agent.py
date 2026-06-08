from typing import Any, Dict
import time
from app.langgraph_config.state.state import State
from app.langgraph_config.node_utils.stage_labels import stage_update
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation
from utils.logger import get_logger
from utils.configure import main_logger, debug_logger, load_config

logger = get_logger("langgraph.nodes.data_analysis_agent")

#################### Data Analysis Agent Node ####################
def data_analysis_agent_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "data_analysis_agent")
    
    logger.info("================= [DATA ANALYSIS AGENT] Starting =================")
    start_time = time.time()
    main_logger.info(f"[DATA ANALYSIS AGENT] Preparing analysis")

    session_id = state.get("session_id", "")
    user_query = (state.get("user_query") or "").strip()
    dataset_available = state.get("dataset_available", False)
    table_file_path = state.get("table_file_path", "")
    schema_summary = state.get("schema_summary", "")
    table_preview = state.get("table_preview", "")
    table_info = state.get("table_info", "")

    if not dataset_available:
        logger.warning("[DATA ANALYSIS AGENT] Dataset not available for analysis.")
        return {
            "final_answer": "No dataset found for this session. Please send table data first.",
            "status": "error",
            "error_message": "Dataset not available for analysis.",
        }

    if not table_file_path:
        logger.warning("[DATA ANALYSIS AGENT] table_file_path missing.")
        return {
            "final_answer": "Dataset file path is missing, so analysis cannot continue.",
            "status": "error",
            "error_message": "table_file_path missing.",
        }

    logger.info(f"[DATA ANALYSIS AGENT] Session ID: {session_id}")
    logger.info(f"[DATA ANALYSIS AGENT] User Query: {user_query}")
    logger.info(f"[DATA ANALYSIS AGENT] Using dataset file: {table_file_path}")
    elapsed_time = time.time() - start_time
    logger.info("===================== [DATA ANALYSIS AGENT] Analysis branch context prepared successfully. ===================== time_taken=%.3fs",elapsed_time,)

    return {
        **stage_update("data_analysis_agent"),
        "status": "analysis_ready",
        "error_message": "",
        "final_answer": "",
        "plan": state.get("plan", ""),
        "generated_code": state.get("generated_code", ""),
        "execution_output": state.get("execution_output", ""),
        "execution_error": state.get("execution_error", ""),
        "table_file_path": table_file_path,
        "schema_summary": schema_summary,
        "table_preview": table_preview,
        "table_info": table_info,
    }
