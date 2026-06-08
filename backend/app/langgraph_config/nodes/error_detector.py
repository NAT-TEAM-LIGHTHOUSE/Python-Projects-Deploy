from typing import Any, Dict
import os
import time 
from app.langgraph_config.state.state import State
from app.langgraph_config.node_utils.stage_labels import stage_update
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation
from utils.logger import get_logger
from utils.configure import main_logger, debug_logger, load_config

logger = get_logger("langgraph.nodes.error_detector")

############## Error Detector Node: Checks for execution errors and determines whether to retry code execution. ################
def error_detector_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "error_detector")
    
    logger.info("================= [ERROR DETECTOR] Starting =================")
    start_time = time.time()
    main_logger.info(f"[ERROR DETECTOR] Checking for execution errors")

    execution_error = (state.get("execution_error") or "").strip()
    retry_count = int(state.get("retry_count", 0))
    max_retries = int(os.getenv("MAX_CODE_FIX_RETRIES", "2"))

    if execution_error:
        logger.warning(
            f"[ERROR DETECTOR] Execution error found. "
            f"retry_count={retry_count}, max_retries={max_retries}"
        )
        return {
            **stage_update("error_detector"),
            "status": "execution_failed" if retry_count < max_retries else "max_retries_exceeded"
        }

    logger.info("[ERROR DETECTOR] No execution error found.")
    elapsed_time = time.time() - start_time
    logger.info("================= [ERROR DETECTOR] Completed ================= time_taken=%.3fs",elapsed_time,)
    return {
        **stage_update("error_detector"),
        "status": "execution_succeeded"
    }
