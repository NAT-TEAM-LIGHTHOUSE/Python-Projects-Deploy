import json
from typing import Any, Dict
import time
import pandas as pd
from app.langgraph_config.node_utils.stage_labels import stage_update
from app.langgraph_config.state.state import State
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation
from utils.logger import get_logger
from utils.configure import main_logger, debug_logger, load_config

logger = get_logger("langgraph.nodes.schema_analyzer")

#### Constants to limit the amount of data included in the LLM prompt for schema and preview
MAX_TABLE_ROWS_FOR_PROMPT = 100
MAX_TABLE_CHARS_FOR_PROMPT = 12000

########################### SCHEMA ANALYZER NODE: EXTRACTS SCHEMA SUMMARY AND TABLE PREVIEW FOR LLM PROMPTING ############################
def schema_analyzer_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "schema_analyzer")
    
    logger.info("================= [SCHEMA ANALYZER] Starting schema analysis =================")
    start_time = time.time()
    main_logger.info(f"[SCHEMA ANALYZER] Preparing to analyze dataset schema and generate preview")
    dataset_available = state.get("dataset_available", False)
    table_file_path = state.get("table_file_path", "")

    if not dataset_available:
        logger.warning("[SCHEMA ANALYZER] Dataset unavailable, schema analysis skipped.")
        return {
            "schema_summary": "No table data available.",
            "table_preview": "",
            "status": "schema_skipped",
        }

    if not table_file_path:
        logger.warning("[SCHEMA ANALYZER] table_file_path missing, schema analysis skipped.")
        return {
            "schema_summary": "No dataset file path available.",
            "table_preview": "",
            "status": "schema_skipped",
        }

    df = pd.read_csv(table_file_path)
    logger.info(f"[SCHEMA ANALYZER] Loaded stored dataset from CSV, shape: {df.shape}")

    if df.empty:
        logger.warning("[SCHEMA ANALYZER] Stored dataset is empty.")
        return {
            "schema_summary": "Stored dataset is empty.",
            "table_preview": "",
            "status": "schema_ready",
        }

    df.columns = [str(col).strip() for col in df.columns]

    preview_df = df.head(MAX_TABLE_ROWS_FOR_PROMPT)
    table_preview = preview_df.to_csv(index=False)
    table_preview = table_preview[:MAX_TABLE_CHARS_FOR_PROMPT]
    logger.info(f"[SCHEMA ANALYZER] Generated table preview for prompt, length: {len(table_preview)} characters")

    schema = []
    for idx, col in enumerate(df.columns):
        series = df.iloc[:, idx]
        sample_values = series.dropna().astype(str).head(3).tolist()
        schema.append(
            {
                "column": col,
                "dtype": str(series.dtype),
                "non_null_count": int(series.notna().sum()),
                "sample_values": sample_values,
            }
        )

    schema_summary = json.dumps(
        {
            "table_file_path": table_file_path,
            "row_count": int(len(df)),
            "column_count": int(len(df.columns)),
            "columns": schema,
        },
        ensure_ascii=False,
        indent=2,
    )
    logger.info(f"[SCHEMA ANALYZER] Generated schema summary")  # Log only the beginning of the schema summary for brevity
    main_logger.info(f"[SCHEMA ANALYZER] Generated schema summary successfully: \n{schema_summary}")
    elapsed_time = time.time() - start_time
    logger.info("============= [SCHEMA ANALYZER] Completed schema analysis ==============, time_taken=%.3fs",elapsed_time,)
    return {
        **stage_update("schema_analyzer"),
        "schema_summary": schema_summary,
        "table_preview": table_preview,
        "status": "schema_ready",
    }
