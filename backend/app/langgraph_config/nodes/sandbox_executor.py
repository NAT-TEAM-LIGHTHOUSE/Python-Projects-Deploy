import os
import subprocess
import sys
from pathlib import Path
from typing import Any, Dict, Tuple
import time
import json
import re
from app.langgraph_config.state.state import State
from app.langgraph_config.node_utils.stage_labels import stage_update
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation
from utils.logger import get_logger
from utils.configure import main_logger, debug_logger, load_config
from ..node_utils.viz_utils import  parse_visualization_output

logger = get_logger("langgraph.nodes.sandbox_executor")

BANNED_PATTERNS = [
    "import os",
    "import subprocess",
    "import shutil",
    "import socket",
    "import requests",
    "from os",
    "from subprocess",
    "from shutil",
    "open(",
    "exec(",
    "eval(",
    "__import__",
]

### Helper function to check if the generated code contains any unsafe patterns that could lead to security risks or system damage.
def _is_code_safe(code: str) -> Tuple[bool, str]:
    lowered = (code or "").lower()

    for pattern in BANNED_PATTERNS:
        if pattern.lower() in lowered:
            return False, f"Unsafe code pattern detected: {pattern}"

    return True, ""

#### Helper function to wrap the generated code with necessary context, such as dataset path, 
# for execution in the sandbox environment. 
# This allows the generated code to reference the dataset without hardcoding paths, 
# and provides a clear structure for the execution script.
def _build_wrapped_code(dataset_path: str, generated_code: str) -> str:
    return f'''import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

DATASET_PATH = r"{dataset_path}"

{generated_code}
'''

######################################## Sandbox Executor Node ###############################
def sandbox_executor_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "sandbox_executor")
    
    logger.info("================= [SANDBOX EXECUTOR] Starting =================")
    start_time = time.time()
    main_logger.info(f"[SANDBOX EXECUTOR] Starting code execution in sandbox environment")

    generated_code = state.get("generated_code", "")
    table_file_path = state.get("table_file_path", "")
    session_dir = state.get("session_dir", "")
    session_id = state.get("session_id", "")

    if not generated_code:
        logger.warning("[SANDBOX EXECUTOR] No generated code found.")
        return {
            "execution_output": "",
            "execution_error": "No generated code available for execution.",
            "status": "execution_failed",
        }

    if not table_file_path:
        logger.warning("[SANDBOX EXECUTOR] No table_file_path found.")
        return {
            "execution_output": "",
            "execution_error": "No table_file_path available for execution.",
            "status": "execution_failed",
        }

    if not Path(table_file_path).exists():
        logger.warning(f"[SANDBOX EXECUTOR] Dataset file not found: {table_file_path}")
        return {
            "execution_output": "",
            "execution_error": f"Dataset file not found: {table_file_path}",
            "status": "execution_failed",
        }

    is_safe, safety_error = _is_code_safe(generated_code)
    if not is_safe:
        logger.warning(f"[SANDBOX EXECUTOR] {safety_error}")
        return {
            "execution_output": "",
            "execution_error": safety_error,
            "status": "execution_failed",
        }

    runtime_dir = Path(session_dir) if session_dir else Path(table_file_path).parent
    runtime_dir.mkdir(parents=True, exist_ok=True)

    script_path = runtime_dir / "generated_analysis.py"
    wrapped_code = _build_wrapped_code(table_file_path, generated_code)

    try:
        script_path.write_text(wrapped_code, encoding="utf-8")
        logger.info(f"[SANDBOX EXECUTOR] Execution script written to: {script_path}")

        timeout_seconds = int(os.getenv("LOCAL_EXECUTION_TIMEOUT_SECONDS", "1000"))

        env = os.environ.copy()
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUTF8"] = "1"

        result = subprocess.run(
            [sys.executable, str(script_path)],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            env=env,
            timeout=timeout_seconds,
        )

        stdout = (result.stdout or "").strip()
        stderr = (result.stderr or "").strip()

        output_file = runtime_dir / "execution_output.txt"
        error_file = runtime_dir / "execution_error.txt"

        output_file.write_text(stdout, encoding="utf-8")
        error_file.write_text(stderr, encoding="utf-8")

        if result.returncode != 0:
            logger.warning(f"[SANDBOX EXECUTOR] Execution failed with return code {result.returncode}")
            main_logger.info(f"[SANDBOX EXECUTOR] Execution failed with return code {result.returncode}. Stderr: \n{stderr[:1000]}..." if stderr else "No stderr output.")
            return {
                "execution_output": stdout,
                "execution_error": stderr or f"Execution failed with return code {result.returncode}",
                "status": "execution_failed",
            }

        logger.info(f"[SANDBOX EXECUTOR] Output: {stdout[:1000]}")
        elapsed_time = time.time() - start_time
        logger.info("============= [SANDBOX EXECUTOR] Execution completed successfully. =============, time_taken=%.3fs",elapsed_time)
        main_logger.info(f"[SANDBOX EXECUTOR] Output: \n{stdout[:1000]}")
        
        # Parse visualization and table data from output
        table_output, viz_json_blocks, remaining = parse_visualization_output(stdout)
        
        visualization_spec = {}
        has_viz = False
        
        if viz_json_blocks:
            visualization_specs = []
            for viz_json in viz_json_blocks:
                try:
                    visualization_specs.append(json.loads(viz_json))
                except json.JSONDecodeError as e:
                    logger.warning(f"[SANDBOX EXECUTOR] Failed to parse visualization JSON: {e}")
                    main_logger.warning(f"[SANDBOX EXECUTOR] Visualization JSON parsing failed: {e}")

            if visualization_specs:
                visualization_spec = visualization_specs[0] if len(visualization_specs) == 1 else visualization_specs
                has_viz = True
                logger.info(f"[SANDBOX EXECUTOR] Visualization JSON extracted successfully. count={len(visualization_specs)}")
                main_logger.info(f"[SANDBOX EXECUTOR] Visualization generated: {type(visualization_spec)}")
        
        # Use table output if available, otherwise use remaining output
        final_output = table_output if table_output else remaining if remaining else stdout
        
        return {
            **stage_update("sandbox_executor"),
            "execution_output": final_output,
            "execution_error": stderr,
            "status": "execution_completed",
            "visualization_spec": visualization_spec,
            "has_visualization": has_viz,
        }

    except subprocess.TimeoutExpired:
        logger.error("[SANDBOX EXECUTOR] Execution timed out.")
        main_logger.info(f"[SANDBOX EXECUTOR] Execution timed out.")
        return {
            **stage_update("sandbox_executor"),
            "execution_output": "",
            "execution_error": "Execution timed out.",
            "status": "execution_failed",
        }
    except Exception as e:
        logger.error(f"[SANDBOX EXECUTOR] Unexpected execution error: {e}")
        main_logger.info(f"[SANDBOX EXECUTOR] Unexpected execution error: {e}")
        return {
            **stage_update("sandbox_executor"),
            "execution_output": "",
            "execution_error": str(e),
            "status": "execution_failed",
        }
