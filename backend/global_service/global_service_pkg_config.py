# Utility to log debug info to Oracle debug log table
from global_service_fastapi_pkg import (
    config,
    save_debug_log_to_oracle,
    build_global_log_payload,
    send_log_to_global_service,
    StepLogger,
    save_step_logs_to_oracle,
    GLOBAL_SERVICE_REMOTE_ACCESS_ENABLED,GLOBAL_SERVICE_LOCAL_STORAGE_ENABLED
)
import logging
import os
import uuid
from datetime import datetime
import json
import asyncio
import threading
from types import SimpleNamespace

# Optionally, define BASE_DIR if needed elsewhere
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Project root and logs directory (one level up from BASE_DIR is repo root)
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR))

# Ensure the package reads the correct global_config.properties at project root
GLOBAL_CONFIG_PATH = os.path.join(PROJECT_ROOT, "global_config.properties")

# Configure Global Service (set your values here)
config.configure(
    GLOBAL_LOG_URL="http://192.168.101.185:5025/web/pyai/admin/api_logs",
    APP_CODE="L-PYA128",
    ORACLE_DB_HOST="192.168.100.233",
    ORACLE_DB_PORT=1521,
    ORACLE_DB_SERVICE="ORCLPDB",
    ORACLE_USER="PYAI_ADMIN_DEV",
    ORACLE_PASS="PYAI_ADMIN_DEV",
    # FAILED_LOG_FILE="app_failed_logs.json"
    # Persist failed remote logs and local activity/access logs under logs/
    REMOTE_ACTIVITY_FAILED_LOG_FILE=os.path.join(PROJECT_ROOT, "remote_activity_failed_logs.json"),
    REMOTE_DEBUG_FAILED_LOG_FILE=os.path.join(PROJECT_ROOT, "remote_debug_failed_logs.json"),
    LOCAL_ACTIVITY_LOG_FILE=os.path.join(PROJECT_ROOT, "local_activity_logs.json"),
    LOCAL_DEBUG_LOG_FILE=os.path.join(PROJECT_ROOT, "local_debug_logs.json"),
    # Point to the repo's global_config.properties so flags are read correctly
    GLOBAL_CONFIG_PATH=GLOBAL_CONFIG_PATH,
)

# Configure logging
logging.basicConfig(level=logging.DEBUG)

class _CaseInsensitiveHeaders(dict):
    def __init__(self, headers=None):
        super().__init__()
        if headers:
            try:
                items = headers.items()
            except Exception:
                items = []
            for key, value in items:
                self[str(key).lower()] = value

    def get(self, key, default=None):
        return super().get(str(key).lower(), default)


class _FrozenStepLogger:
    def __init__(self, step_logger):
        try:
            self.steps = list(step_logger.steps)
        except Exception:
            self.steps = []

    def get_log_remark(self):
        lines = [f"Step {num}: {ts} {name}" for num, ts, name in self.steps]
        return "\n".join(lines)


def _extract_req_uuid(request, request_body):
    req_uuid = None
    try:
        body = None
        if request_body:
            if isinstance(request_body, dict):
                body = request_body
            elif isinstance(request_body, str):
                try:
                    body = json.loads(request_body)
                except Exception:
                    body = None
        if body:
            pid = body.get("payload_identifier", {}) or {}
            user_ref = pid.get("user_ref_no")
            if user_ref:
                req_uuid = str(user_ref)
    except Exception:
        req_uuid = None

    if req_uuid:
        return req_uuid

    try:
        return request.headers.get("x-request-uuid") or str(uuid.uuid4())[:16]
    except Exception:
        return str(uuid.uuid4())[:16]


def _capture_fastapi_request(request):
    try:
        headers = _CaseInsensitiveHeaders(request.headers)
    except Exception:
        headers = _CaseInsensitiveHeaders()

    try:
        session = dict(request.session)
    except Exception:
        session = {}

    try:
        path = str(request.url.path)
    except Exception:
        path = ""

    try:
        client_host = request.client.host if request.client else ""
    except Exception:
        client_host = ""

    return SimpleNamespace(
        headers=headers,
        session=session,
        url=SimpleNamespace(path=path),
        client=SimpleNamespace(host=client_host) if client_host else None,
    )


def _run_activity_log_async(
    request_snapshot,
    step_logger_snapshot,
    request_body,
    response_body,
    log_type,
    app_version,
    req_uuid,
    payload_rrn,
    payload_request_status_code,
    payload_response_status_msg,
):
    try:
        payload = build_global_log_payload(
            request_snapshot,
            app_version=app_version,
            request_body=request_body,
            uuid=req_uuid,
            payload_rrn=payload_rrn,
            payload_request_status_code=payload_request_status_code,
            payload_response_status_msg=payload_response_status_msg,
        )
    except Exception as e:
        logging.error(f"Async activity payload build failed: {e}")
        payload = {}

    try:
        if payload and (GLOBAL_SERVICE_REMOTE_ACCESS_ENABLED or GLOBAL_SERVICE_LOCAL_STORAGE_ENABLED):
            send_log_to_global_service(payload)
        elif not (GLOBAL_SERVICE_REMOTE_ACCESS_ENABLED or GLOBAL_SERVICE_LOCAL_STORAGE_ENABLED):
            logging.info("Remote logging disabled, saving locally only.")
    except Exception as e:
        logging.error(f"Async activity remote logging failed: {e}")

    try:
        if payload:
            save_step_logs_to_oracle(payload, step_logger_snapshot, request_body, response_body, log_type=log_type)
    except Exception as e:
        logging.error(f"Async activity step logging failed: {e}")


def _run_debug_log_async(
    request_snapshot,
    request_body,
    response_body,
    debug_logs,
    debug_active_by,
    debug_end_by,
    start_time,
    end_time,
    flag,
    req_uuid,
    payload_rrn,
):
    try:
        payload = build_global_log_payload(
            request_snapshot,
            uuid=req_uuid,
            payload_rrn=payload_rrn,
            request_body=request_body,
        )
        if config.SAVE_DEBUG_LOGS:
            save_debug_log_to_oracle(
                payload=payload,
                request_body=request_body,
                response_body=response_body,
                debug_logs=debug_logs,
                debug_active_by=debug_active_by,
                debug_end_by=debug_end_by,
                start_time=start_time,
                end_time=end_time,
                flag=flag,
            )
    except Exception as e:
        logging.error(f"Async debug logging failed: {e}")


def _schedule_log_task(task, *args):
    try:
        loop = asyncio.get_running_loop()
        loop.create_task(asyncio.to_thread(task, *args))
        return
    except RuntimeError:
        pass
    except Exception as e:
        logging.error(f"Failed to schedule async log task: {e}")
        return

    thread = threading.Thread(target=task, args=args, daemon=True)
    thread.start()


# Function to log requests
def log_request(
    request, step_logger, request_body="", response_body="", 
    log_type="INFO", app_version=None,
    payload_request_status_code=None, payload_response_status_msg=None
):
    req_uuid = _extract_req_uuid(request, request_body)
    payload_rrn = str(uuid.uuid4())[:8]

    # Save identifiers on request.state so subsequent log calls reuse the same values
    try:
        request.state.req_uuid = req_uuid
        request.state.payload_rrn = payload_rrn
    except Exception:
        # If request.state isn't available for any reason, continue without failing
        pass

    request_snapshot = _capture_fastapi_request(request)
    step_logger_snapshot = _FrozenStepLogger(step_logger)

    task_args = (
        request_snapshot,
        step_logger_snapshot,
        request_body or "",
        response_body or "",
        log_type or "INFO",
        app_version,
        req_uuid,
        payload_rrn,
        payload_request_status_code,
        payload_response_status_msg,
    )
    _schedule_log_task(_run_activity_log_async, *task_args)

def log_debug_request(fastapi_request, request_body=None, response_body=None, debug_logs=None, debug_active_by=None, debug_end_by=None, start_time=None, end_time=None, flag=None, uuid_val=None, payload_rrn_val=None):
    print("[DEBUG] log_debug_request from global_service_pkg_config.py called")
    request = fastapi_request  # for naming consistency
    # Resolve identifiers: prefer explicit args, then request.state, then headers/session, then generated
    if uuid_val:
        req_uuid = uuid_val
    elif hasattr(request, "state") and hasattr(request.state, "req_uuid"):
        req_uuid = request.state.req_uuid
    else:
        req_uuid = request.headers.get("x-request-uuid") or str(uuid.uuid4())[:16]

    if payload_rrn_val:
        payload_rrn = payload_rrn_val
    elif hasattr(request, "state") and hasattr(request.state, "payload_rrn"):
        payload_rrn = request.state.payload_rrn
    else:
        try:
            payload_rrn = request.session.get("session_id") or str(uuid.uuid4())[:8]
        except Exception:
            payload_rrn = str(uuid.uuid4())[:8]

    # Persist resolved identifiers back to request.state for future reuse
    try:
        request.state.req_uuid = req_uuid
        request.state.payload_rrn = payload_rrn
    except Exception:
        pass

    print(f"[DEBUG][log_debug_request] UUID: {req_uuid}, PAYLOAD_RRN: {payload_rrn}")
    request_snapshot = _capture_fastapi_request(request)
    task_args = (
        request_snapshot,
        request_body,
        response_body,
        debug_logs,
        debug_active_by or getattr(config, "debug_active_by", None),
        debug_end_by or getattr(config, "debug_end_by", None),
        start_time or getattr(config, "start_time", None),
        end_time or getattr(config, "end_time", None),
        flag,
        req_uuid,
        payload_rrn,
    )
    _schedule_log_task(_run_debug_log_async, *task_args)
