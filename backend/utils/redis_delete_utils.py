import re
import redis
from pathlib import Path
from typing import Optional, Dict, Any
import os
from utils.logger import get_logger

logger = get_logger("redis_delete_utils")

def _safe_session_id(session_id: Optional[str]) -> str:
    session_id = (session_id or "").strip()
    if not session_id:
        raise ValueError("user_ref_no is required.")
    return re.sub(r"[^A-Za-z0-9._-]", "_", session_id)


def _runtime_session_base_dir() -> Path:
    return Path(__file__).resolve().parents[1] / "runtime" / "session_data"


def _delete_redis_session_keys(session_id: str) -> int:
    redis_url = os.getenv("REDIS_URL", "").strip()
    use_redis_cp = os.getenv("LANGGRAPH_USE_REDIS_CHECKPOINTER", "false").lower() in ("1", "true", "yes")

    if not use_redis_cp or not redis_url:
        logger.info(f"Redis session cleanup skipped for session_id={session_id}. Redis checkpointer disabled or REDIS_URL missing.")
        return 0

    client = redis.Redis.from_url(redis_url, decode_responses=True)
    deleted_count = 0

    # Delete only keys that contain this thread/session id.
    # LangGraph Redis checkpointer stores multiple internal keys per thread.
    matching_keys = list(client.scan_iter(match=f"*{session_id}*"))
    logger.info(f"Redis session cleanup scan completed for session_id={session_id}. Matching keys found: {len(matching_keys)}")
    if matching_keys:
        deleted_count = client.delete(*matching_keys)
        logger.info(f"Deleted {deleted_count} Redis keys for session_id={session_id}")
    else:
        logger.info(f"No Redis keys found for session_id={session_id}")

    return deleted_count