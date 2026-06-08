import json
import re
from io import StringIO
from pathlib import Path
from typing import Any, Dict, Optional

import pandas as pd
from app.langgraph_config.node_utils.stage_labels import stage_update
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation
from app.components.data_cleaning import clean_table_cells
from app.components.session_utils import _ensure_session_lifecycle, resolve_session_table_file_path
from app.langgraph_config.state.state import State
from utils.logger import get_logger

logger = get_logger("langgraph.nodes.session_dataset_loader")


def _safe_session_id(session_id: Optional[str]) -> str:
    session_id = (session_id or "").strip()
    if not session_id:
        return "default-session"
    return re.sub(r"[^A-Za-z0-9._-]", "_", session_id)


def _runtime_base_dir() -> Path:
    # backend/app/langgraph_config/nodes/session_dataset_loader.py
    # parents[3] => backend
    return Path(__file__).resolve().parents[3] / "runtime" / "session_data"


def _to_dataframe(table_data: Any) -> Optional[pd.DataFrame]:
    if table_data is None:
        return None

    if isinstance(table_data, pd.DataFrame):
        return table_data.copy()

    if isinstance(table_data, list):
        if len(table_data) > 1 and isinstance(table_data[0], list):
            return pd.DataFrame(table_data[1:], columns=table_data[0])
        return pd.DataFrame(table_data)

    if isinstance(table_data, str):
        stripped = table_data.strip()
        if not stripped:
            return None

        try:
            parsed = json.loads(stripped)
            if isinstance(parsed, list):
                if len(parsed) > 1 and isinstance(parsed[0], list):
                    return pd.DataFrame(parsed[1:], columns=parsed[0])
                return pd.DataFrame(parsed)
        except json.JSONDecodeError:
            pass

        return pd.read_csv(StringIO(stripped), on_bad_lines="skip")

    return None

############### Session Dataset Loader Node ###########################
def session_dataset_loader_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "session_dataset_loader")
    
    session_id = _safe_session_id(state.get("session_id"))
    table_data = state.get("table_data")

    base_dir = _runtime_base_dir()
    session_dir = base_dir / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    _ensure_session_lifecycle(session_id)

    table_file_name = "input_table.csv"
    table_file_path = session_dir / table_file_name

    if table_data is not None and str(table_data).strip() != "":
        df = _to_dataframe(table_data)

        if df is None or df.empty:
            return {
                **stage_update("session_dataset_loader"),
                "session_dir": str(session_dir),
                "table_file_name": table_file_name,
                "table_file_path": str(table_file_path),
                "dataset_available": False,
                "error_message": "Incoming table_data could not be parsed into a valid dataset.",
                "status": "dataset_load_failed",
            }
        ########## Only clean table cell when the table_data is coming in the request, if we are loading from existing csv, we assume it's 
        # already cleaned and we want to preserve the original formatting in that case.
        
        # df = clean_table_cells(df)
        df.columns = [str(col).strip() for col in df.columns]
        df.to_csv(table_file_path, index=False, encoding="utf-8")

        logger.info(f"Stored session dataset at: {table_file_path}")

        return {
            **stage_update("session_dataset_loader"),
            "session_id": session_id,
            "session_dir": str(session_dir),
            "table_file_name": table_file_name,
            "table_file_path": str(table_file_path),
            "dataset_available": True,
            "error_message": "",
            "status": "dataset_ready",
        }

    if table_file_path.exists():
        logger.info(f"Reusing stored session dataset: {table_file_path}")
        return {
            **stage_update("session_dataset_loader"),
            "session_id": session_id,
            "session_dir": str(session_dir),
            "table_file_name": table_file_name,
            "table_file_path": str(table_file_path),
            "dataset_available": True,
            "error_message": "",
            "status": "dataset_ready",
        }

    resolved_table_file_path = resolve_session_table_file_path(session_id)
    if resolved_table_file_path.exists():
        logger.info(
            f"Using fixed stored CSV dataset for session_id={session_id}: {resolved_table_file_path}"
        )
        return {
            **stage_update("session_dataset_loader"),
            "session_id": session_id,
            "session_dir": str(session_dir),
            "table_file_name": resolved_table_file_path.name,
            "table_file_path": str(resolved_table_file_path),
            "dataset_available": True,
            "error_message": "",
            "status": "dataset_ready",
        }

    return {
        **stage_update("session_dataset_loader"),
        "session_id": session_id,
        "session_dir": str(session_dir),
        "table_file_name": table_file_name,
        "table_file_path": str(table_file_path),
        "dataset_available": False,
        "error_message": "No dataset found for this session. Please send table_data in the first request.",
        "status": "dataset_load_failed",
    }
