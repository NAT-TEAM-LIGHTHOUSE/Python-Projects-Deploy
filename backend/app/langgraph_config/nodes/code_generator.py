from typing import Any, Dict
import re
import time
from app.langgraph_config.state.state import State
from app.llm.get_llm import GlobalLLM
from app.components.prompt_loader import GlobalPromptLoader
from app.langgraph_config.node_utils.stage_labels import stage_update
from app.langgraph_config.node_utils.message_utils import (
    normalize_text,
    normalize_history,
    get_recent_history_for_prompt,
    compact_schema_summary,
    compact_table_preview,
    compact_guidance,
    truncate_text,
)
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation

from utils.logger import get_logger
from utils.configure import main_logger, debug_logger, load_config
from ..node_utils.clean_generated_code import _clean_generated_code

logger = get_logger("langgraph.nodes.code_generator")

llm = GlobalLLM(llm_service="anthropic", model="claude-haiku-4-5")

prompt_loader = GlobalPromptLoader()

CODE_GENERATOR_SYSTEM_PROMPT = """
You are the Code Generator for Table-GPT.

Generate Python pandas code to answer the user's request.

Rules:
- Return only Python code.
- Do not wrap code in markdown fences.
- The dataset path will be available in a variable named DATASET_PATH.
- Always load the dataset using:
    df = pd.read_csv(DATASET_PATH, low_memory=False)
- Use only columns that exist in the provided schema.
- Do not invent columns.
- The code must be executable as-is.
- Print the final result clearly.
- If the result is a dataframe, print it as an HTML table with:
    print(result.reset_index(drop=True).to_html(border=1, index=False, justify='center', header=True, index_names=False, float_format='{:,.2f}'.format))
- If the result is a scalar, print it directly.
- Do not use unsafe operations, file deletion, networking, subprocesses, or shell commands.
- Use recent conversation context when the current request is a follow-up.
- Always use the to_html in code for table output and do not use at all to_string.

IMPORTANT: If visualization is required:
- You MUST use plotly.graph_objects to create the chart
- Always import: import plotly.graph_objects as go, import json
- Create the figure and output it as JSON between markers:
    print("<PLOTLY_JSON>")
    print(json.dumps(fig.to_json()))
    print("</PLOTLY_JSON>")
- Output the data table or results BEFORE the visualization JSON
- Use markers: <DATA_TABLE_START> ... <DATA_TABLE_END> for tabular output

IMPORTANT: If visualization is NOT required:
- Do not import plotly, matplotlib, seaborn, graph_objects, or any charting library.
- Do not create figures, charts, plots, dashboards, or visualization JSON.
- Do not print <PLOTLY_JSON> markers.
- Return only textual output or HTML table output.
""".strip()


def _get_code_prompt() -> str:
    try:
        return prompt_loader.get_prompt("code_prompt.txt")
    except Exception:
        pass 

############################## Code Generator Node ###############################
def code_generator_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "code_generator")
    
    logger.info("================= [CODE GENERATOR] Starting =================")
    start_time = time.time()

    user_query = (state.get("user_query") or "").strip()
    plan = truncate_text(state.get("plan", ""), 2500)
    schema_summary = compact_schema_summary(state.get("schema_summary", ""), max_columns=16, max_chars=1800)
    table_preview = compact_table_preview(state.get("table_preview", ""), max_chars=900)
    custom_prompt = compact_guidance(state.get("custom_prompt", ""), max_chars=1000, max_lines=14)
    ai_prompt = compact_guidance(state.get("ai_prompt", ""), max_chars=4000, max_lines=100)
    chat_history = normalize_history(state.get("chat_history", []))
    recent_history = get_recent_history_for_prompt(
        chat_history,
        max_turns=2,
        max_total_chars=1000,
        max_message_chars=250,
    )
    dataset_available = state.get("dataset_available", False)
    table_file_path = state.get("table_file_path", "")
    
    # Visualization context
    visualization_request = state.get("visualization_request", False)
    visualization_spec = state.get("visualization_spec", {})

    if not dataset_available:
        logger.warning("[CODE GENERATOR] Dataset not available.")
        return {
            "generated_code": "",
            "status": "error",
            "error_message": "Dataset not available for code generation.",
            "final_answer": "No dataset found for this session. Please send table data first.",
        }

    if not table_file_path:
        logger.warning("[CODE GENERATOR] table_file_path missing.")
        return {
            "generated_code": "",
            "status": "error",
            "error_message": "Dataset file path missing for code generation.",
            "final_answer": "Dataset file path is missing, so code generation cannot continue.",
        }

    if not plan:
        logger.warning("[CODE GENERATOR] Plan missing.")
        return {
            "generated_code": "",
            "status": "error",
            "error_message": "Plan missing for code generation.",
            "final_answer": "Analysis plan is missing, so code generation cannot continue.",
        }

    prompt_template = _get_code_prompt()
    
    # Use different logic based on visualization request
    if visualization_request:
        # Load visualization-specific prompt
        try:
            prompt_template = prompt_loader.get_prompt("visualization_code_prompt.txt")
        except Exception:
            logger.warning("[CODE GENERATOR] Failed to load visualization prompt, using standard prompt.")
        
        # Build visualization prompt with specific parameters
        color_by_text = ""
        if visualization_spec.get('color_by'):
            color_by_text = f"Color By: {visualization_spec.get('color_by')}"
        
        prompt = prompt_template.format(
            user_query=user_query,
            plan=plan,
            schema_summary=schema_summary,
            table_preview=table_preview,
            custom_prompt=custom_prompt,
            ai_prompt=ai_prompt,
            chart_type=visualization_spec.get('chart_type', 'bar'),
            chart_title=visualization_spec.get('title', 'Chart'),
            x_axis=visualization_spec.get('x_axis', ''),
            y_axis=visualization_spec.get('y_axis', ''),
            color_by_text=color_by_text,
        )
    else:
        # Standard data analysis prompt
        prompt = prompt_template.format(
            user_query=user_query,
            plan=plan,
            schema_summary=schema_summary,
            table_preview=table_preview,
            custom_prompt=custom_prompt,
            ai_prompt=ai_prompt,
        )

    messages = [
        {
            "role": "system",
            "content": CODE_GENERATOR_SYSTEM_PROMPT,
        },
        *recent_history,
        {
            "role": "user",
            "content": prompt,
        },
    ]

    logger.info("[CODE GENERATOR] Invoking LLM for Python code generation.")
    if visualization_request:
        logger.info(f"[CODE GENERATOR] Generating code for {visualization_spec.get('chart_type', 'bar')} visualization.")
    generated_code = _clean_generated_code(llm.get_response(messages))

    logger.info(f"[CODE GENERATOR] Code generated: {generated_code}")
    main_logger.info(f"[CODE GENERATOR] Python Code generated: \n{generated_code}")
    elapsed_time = time.time() - start_time
    logger.info("===================== [CODE GENERATOR] Code generation completed successfully. ===================== time_taken=%.3fs",elapsed_time,)

    return {
        **stage_update("code_generator"),
        "generated_code": generated_code,
        "status": "code_generated",
        "error_message": "",
    }
