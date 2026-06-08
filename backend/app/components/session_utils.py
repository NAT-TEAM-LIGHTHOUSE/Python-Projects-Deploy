import json
import os
import shutil
import time
from datetime import datetime, timezone
from pathlib import Path
from utils.redis_delete_utils import _runtime_session_base_dir, _delete_redis_session_keys
from typing import Dict, Any, List
import pandas as pd
from utils.logger import get_logger

logger = get_logger("session_utils")
############### Session Data Persistence and Retrieval Utilities ###########################
def _session_lifecycle_file_path(session_id: str):
    return _runtime_session_base_dir() / session_id / "session_lifecycle.json"


def _get_session_ttl_seconds() -> int:
    return int(os.getenv("SESSION_TTL_SECONDS", "3600"))


def _get_session_cleanup_interval_seconds() -> int:
    return int(os.getenv("SESSION_CLEANUP_INTERVAL_SECONDS", "300"))


def _ensure_session_lifecycle(session_id: str) -> Dict[str, Any]:
    session_dir = _runtime_session_base_dir() / session_id
    session_dir.mkdir(parents=True, exist_ok=True)

    lifecycle_path = _session_lifecycle_file_path(session_id)
    if lifecycle_path.exists():
        try:
            return json.loads(lifecycle_path.read_text(encoding="utf-8"))
        except Exception:
            pass

    created_at_epoch = int(time.time())
    lifecycle = {
        "session_id": session_id,
        "created_at_epoch": created_at_epoch,
        "created_at_iso": datetime.fromtimestamp(created_at_epoch, tz=timezone.utc).isoformat(),
    }
    lifecycle_path.write_text(json.dumps(lifecycle, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"Created session lifecycle metadata for session_id={session_id} at {lifecycle_path}")
    return lifecycle


def _get_session_created_at_epoch(session_id: str) -> int:
    lifecycle_path = _session_lifecycle_file_path(session_id)
    if lifecycle_path.exists():
        try:
            lifecycle = json.loads(lifecycle_path.read_text(encoding="utf-8"))
            created_at_epoch = int(lifecycle.get("created_at_epoch", 0))
            if created_at_epoch > 0:
                return created_at_epoch
        except Exception:
            pass

    session_dir = _runtime_session_base_dir() / session_id
    return int(session_dir.stat().st_ctime)


def cleanup_expired_sessions(ttl_seconds: int | None = None) -> int:
    base_dir = _runtime_session_base_dir()
    if not base_dir.exists():
        return 0

    ttl = ttl_seconds or _get_session_ttl_seconds()
    now_epoch = int(time.time())
    deleted_count = 0

    for session_dir in base_dir.iterdir():
        if not session_dir.is_dir():
            continue

        session_id = session_dir.name
        try:
            created_at_epoch = _get_session_created_at_epoch(session_id)
            age_seconds = now_epoch - created_at_epoch

            if age_seconds < ttl:
                continue

            shutil.rmtree(session_dir, ignore_errors=False)
            redis_deleted_keys = _delete_redis_session_keys(session_id)
            deleted_count += 1
            logger.info(
                f"Auto-deleted expired session_id={session_id}, "
                f"age_seconds={age_seconds}, redis_deleted_keys={redis_deleted_keys}"
            )
        except Exception as e:
            logger.error(f"Failed to auto-delete expired session_id={session_id}: {e}")

    return deleted_count


def _embed_metadata_file_path(session_id: str):
    return _runtime_session_base_dir() / session_id / "embed_metadata.json"


def _dataset_source_file_path(session_id: str):
    return _runtime_session_base_dir() / session_id / "dataset_source.json"


def _store_embed_metadata(session_id: str, payload_identifier: Dict[str, Any], payload_data: Dict[str, Any]) -> Dict[str, Any]:
    session_dir = _runtime_session_base_dir() / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    _ensure_session_lifecycle(session_id)

    metadata = {
        "session_id": session_id,
        "payload_identifier": payload_identifier,
        "payload_data": {k: v for k, v in payload_data.items() if k != "table_data"},
    }

    metadata_path = _embed_metadata_file_path(session_id)
    metadata_path.write_text(json.dumps(metadata, ensure_ascii=False, indent=2), encoding="utf-8")
    logger.info(f"Stored embed metadata for session_id={session_id} at {metadata_path}")
    return metadata


def _load_embed_metadata(session_id: str) -> Dict[str, Any]:
    metadata_path = _embed_metadata_file_path(session_id)
    if not metadata_path.exists():
        return {}
    return json.loads(metadata_path.read_text(encoding="utf-8"))


def _load_session_csv_preview(session_id: str, max_rows: int = 5) -> str:
    table_file_path = resolve_session_table_file_path(session_id)
    if not table_file_path.exists():
        return ""
    df = pd.read_csv(table_file_path, on_bad_lines="skip")
    return df.head(max_rows).to_csv(index=False)

######### Utilities to manage permanent CSV-backed chatbot options and sessions, allowing users to create embed sessions based on pre-stored CSV bots without
# needing to include the full dataset in the request. This is useful for scenarios where the same CSV bot is reused across multiple sessions or users. #########
def _stored_csv_base_dir() -> Path:
    return Path(__file__).resolve().parents[2] / "TableGpt_Plus"


def _db_properties_path() -> Path:
    return Path(__file__).resolve().parents[2] / "db.properties"


def _load_stored_csv_bot_display_names() -> Dict[str, str]:
    properties_path = _db_properties_path()
    if not properties_path.exists():
        return {}

    mappings: Dict[str, str] = {}
    in_bot_names_section = False

    for raw_line in properties_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue

        if line.startswith("[") and line.endswith("]"):
            in_bot_names_section = line[1:-1].strip() == "BOT_NAMES"
            continue

        if not in_bot_names_section or "=" not in line:
            continue

        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if key and value:
            mappings[key] = value

    return mappings


def _stored_csv_bot_id(csv_path: Path) -> str:
    relative_path = csv_path.relative_to(_stored_csv_base_dir())
    return "__".join(relative_path.with_suffix("").parts)

def _stored_csv_prompt_path(csv_path: Path) -> Path:
    return csv_path.with_suffix(".txt")

#### Get the list of bots name and id
def list_stored_csv_bots() -> List[Dict[str, Any]]:
    base_dir = _stored_csv_base_dir()
    if not base_dir.exists():
        return []

    display_names = _load_stored_csv_bot_display_names()
    bots = []
    for csv_path in sorted(base_dir.rglob("*.csv")):
        if not csv_path.is_file():
            continue

        relative_path = csv_path.relative_to(base_dir)
        display_name = (
            display_names.get(relative_path.parent.name)
            or display_names.get(csv_path.stem)
        )
        if not display_name:
            continue

        bots.append(
            {
                "bot_id": _stored_csv_bot_id(csv_path),
                "name": display_name,
            }
        )

    return bots


def resolve_stored_csv_bot(bot_id: str) -> Dict[str, Any]:
    base_dir = _stored_csv_base_dir()
    if not base_dir.exists():
        return {}

    display_names = _load_stored_csv_bot_display_names()
    for csv_path in sorted(base_dir.rglob("*.csv")):
        if not csv_path.is_file() or _stored_csv_bot_id(csv_path) != bot_id:
            continue

        relative_path = csv_path.relative_to(base_dir)
        display_name = (
            display_names.get(relative_path.parent.name)
            or display_names.get(csv_path.stem)
        )
        if not display_name:
            return {}

        return {
            "bot_id": bot_id,
            "name": display_name,
            "relative_path": str(relative_path).replace("\\", "/"),
        }
    return {}


def load_stored_csv_prompt(bot_id: str) -> str:
    bot = resolve_stored_csv_bot(bot_id)
    if not bot:
        return ""

    base_dir = _stored_csv_base_dir().resolve()
    csv_path = (base_dir / bot["relative_path"]).resolve()
    prompt_path = _stored_csv_prompt_path(csv_path).resolve()

    if not prompt_path.is_file() or base_dir not in prompt_path.parents:
        return ""

    try:
        return prompt_path.read_text(encoding="utf-8").strip()
    except UnicodeDecodeError:
        return prompt_path.read_text(encoding="latin-1").strip()
    except Exception as e:
        logger.error(f"Failed to load stored CSV prompt for bot_id={bot_id}: {e}")
        return ""


def _load_session_dataset_source(session_id: str) -> Dict[str, Any]:
    source_path = _dataset_source_file_path(session_id)
    if not source_path.exists():
        return {}

    try:
        return json.loads(source_path.read_text(encoding="utf-8"))
    except Exception as e:
        logger.error(f"Failed to load dataset source for session_id={session_id}: {e}")
        return {}


def resolve_session_table_file_path(session_id: str) -> Path:
    runtime_table_file_path = _runtime_session_base_dir() / session_id / "input_table.csv"
    if runtime_table_file_path.exists():
        return runtime_table_file_path

    source = _load_session_dataset_source(session_id)
    if source.get("source_type") != "stored_csv":
        return runtime_table_file_path

    table_file_path = Path(str(source.get("table_file_path") or "")).resolve()
    base_dir = _stored_csv_base_dir().resolve()
    if table_file_path.is_file() and base_dir in table_file_path.parents:
        return table_file_path

    return runtime_table_file_path


def bind_stored_csv_to_session(bot_id: str, session_id: str) -> Dict[str, Any]:
    bot = resolve_stored_csv_bot(bot_id)
    if not bot:
        return {
            "dataset_available": False,
            "error_message": "Selected CSV bot was not found.",
        }

    base_dir = _stored_csv_base_dir()
    source_path = (base_dir / bot["relative_path"]).resolve()
    if not source_path.is_file() or base_dir.resolve() not in source_path.parents:
        return {
            "dataset_available": False,
            "error_message": "Selected CSV bot path is invalid.",
        }

    session_dir = _runtime_session_base_dir() / session_id
    session_dir.mkdir(parents=True, exist_ok=True)
    _ensure_session_lifecycle(session_id)

    source = {
        "source_type": "stored_csv",
        "bot_id": bot_id,
        "table_file_name": source_path.name,
        "table_file_path": str(source_path),
        "source_bot": bot,
    }
    _dataset_source_file_path(session_id).write_text(
        json.dumps(source, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    logger.info(
        f"Bound stored CSV bot '{bot_id}' at {source_path} to session_id={session_id}"
    )

    return {
        "dataset_available": True,
        "session_id": session_id,
        "session_dir": str(session_dir),
        "table_file_name": source_path.name,
        "table_file_path": str(source_path),
        "source_bot": bot,
        "error_message": "",
    }
