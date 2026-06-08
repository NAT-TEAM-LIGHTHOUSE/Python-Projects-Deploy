STAGE_LABELS = {
    "session_dataset_loader": "Initializing",
    "schema_analyzer": "Understanding table structure",
    "intent_classifier": "Detecting user intent",
    "qa_agent": "Generating answer",
    "data_analysis_agent": "Preparing analysis",
    "query_planner": "Planning analysis",
    "visualization_planner": "Working on analysis",
    "code_generator": "Generating code",
    "sandbox_executor": "Executing analysis",
    "error_detector": "Checking execution result",
    "code_fix_agent": "Fixing execution issues",
    "response_formatter": "Formatting response",
}

def stage_update(node_name: str) -> dict:
    return {
        "current_stage": node_name,
        "current_stage_label": STAGE_LABELS.get(node_name, node_name),
    }