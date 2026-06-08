from typing import Any, Dict
import re
import time
import json
from app.langgraph_config.state.state import State
from app.llm.get_llm import GlobalLLM
from app.components.prompt_loader import GlobalPromptLoader
from app.langgraph_config.node_utils.message_utils import (
    normalize_text,
    compact_schema_summary,
    compact_table_preview,
    compact_guidance,
)
from app.langgraph_config.node_utils.cancellation import check_cancellation, handle_cancellation
from app.langgraph_config.node_utils.stage_labels import stage_update
from utils.logger import get_logger
from utils.configure import main_logger, debug_logger, load_config

logger = get_logger("langgraph.nodes.visualization_planner")

llm = GlobalLLM(llm_service="anthropic", model="claude-haiku-4-5")
prompt_loader = GlobalPromptLoader()

VISUALIZATION_PLANNER_SYSTEM_PROMPT = """
You are the Visualization Planner for Table-GPT.

Your job is to analyze the user's request and determine if a visualization (chart) should be created.

Rules:
- Return ONLY valid JSON, no markdown formatting
- Create a visualization ONLY when the user's own question explicitly asks for one.
- Explicit visualization requests include words/phrases like: chart, graph, plot, visualize, visualization, diagram, dashboard, heatmap, histogram, scatter plot, line chart, bar chart, pie chart, donut chart, gauge, draw a chart, show as chart, trend, trends, over time, over a period of time, periodic.
- Create a visualization when the user's own question asks for trend, trends, over time, over a period of time, periodic, or another time-based pattern where visualization is needed.
- Do NOT create visualizations just because the analysis contains grouping, totals, comparisons, breakdowns, "by", "per".
- For normal analysis, summary, KPI, top-N, list, table, count, aggregate, report, explain, or compare requests, set needs_visualization to false unless the user explicitly asked for a chart/visual/dashboard.
- Choose appropriate chart types:
  - bar: comparing categories or aggregated values
  - line: showing trends over time
  - pie: showing proportions/percentages
  - scatter: showing correlations or patterns
  - heatmap: showing patterns across two dimensions
  - histogram: showing distributions
  - box: showing statistical distributions
  - area: showing stacked or cumulative trends
- Determine X and Y axes based on the analysis plan
- If visualization is not suitable, set needs_visualization to false
- Keep chart_type in lowercase
""".strip()

def _get_visualization_prompt() -> str:
    try:
        return prompt_loader.get_prompt("visualization_planner.txt")
    except Exception:
        logger.warning("[VISUALIZATION PLANNER] Failed to load custom prompt.")
        return ""

def _detect_visualization_keywords(text: str) -> bool:
    """Check if the user explicitly requested a visualization."""
    text_lower = text.lower()
    viz_patterns = [
        r"\bchart(s)?\b",
        r"\bgraph(s)?\b",
        r"\bplot(s|ted|ting)?\b",
        r"\bvisuali[sz](e|ation|ations|ing)?\b",
        r"\bdiagram(s)?\b",
        r"\bdashboard(s)?\b",
        r"\bheat\s*map(s)?\b",
        r"\bheatmap(s)?\b",
        r"\bhistogram(s)?\b",
        r"\bscatter\s*plot(s)?\b",
        r"\bline\s*chart(s)?\b",
        r"\bbar\s*chart(s)?\b",
        r"\bpie\s*chart(s)?\b",
        r"\bdonut\s*chart(s)?\b",
        r"\bgauge(s)?\b",
        r"\bdraw\s+(a\s+)?(chart|graph|plot)\b",
        r"\bshow\s+(it|this|result|results|data)?\s*(as|in)\s+(a\s+)?(chart|graph|plot|dashboard)\b",
        r"\btrend(s)?\b",
        r"\bover\s+time\b",
        r"\bover\s+a\s+period\s+of\s+time\b",
        r"\bperiodic\b",
        r"\btime[-\s]?series\b",
    ]
    return any(re.search(pattern, text_lower) for pattern in viz_patterns)

def _parse_visualization_spec(response_text: str) -> Dict[str, Any]:
    """Parse LLM response to extract visualization specification"""
    try:
        # Try to extract JSON from the response
        response_text = response_text.strip()
        
        # Handle cases where JSON might be wrapped in markdown
        if response_text.startswith("```json"):
            response_text = response_text[7:]
        if response_text.startswith("```"):
            response_text = response_text[3:]
        if response_text.endswith("```"):
            response_text = response_text[:-3]
        
        response_text = response_text.strip()
        
        spec = json.loads(response_text)
        return spec
    except json.JSONDecodeError as e:
        logger.error(f"[VISUALIZATION PLANNER] Failed to parse JSON response: {e}")
        logger.debug(f"Response text: {response_text}")
        return {"needs_visualization": False, "reasoning": "Failed to parse visualization specification"}

######################################## Visualization Planner Node #######################
def visualization_planner_node(state: State) -> Dict[str, Any]:
    # Check for cancellation
    if check_cancellation(state):
        return handle_cancellation(state, "visualization_planner")
    
    logger.info("================= [VISUALIZATION PLANNER] Starting =================")
    start_time = time.time()
    main_logger.info(f"[VISUALIZATION PLANNER] Starting to determine visualization requirements")

    user_query = (state.get("user_query") or "").strip()
    plan = (state.get("plan") or "").strip()
    schema_summary = compact_schema_summary(state.get("schema_summary", ""), max_columns=18, max_chars=2600)
    table_preview = compact_table_preview(state.get("table_preview", ""), max_chars=1400)
    intent = (state.get("intent") or "").strip().lower()

    # Default: no visualization for QA queries
    if intent == "qa":
        logger.info("[VISUALIZATION PLANNER] QA query detected. Skipping visualization planning.")
        return {
            **stage_update("visualization_planner"),
            "visualization_request": False,
            "visualization_type": "",
            "visualization_spec": {},
            "has_visualization": False,
            "visualization_error": "",
        }

    # Only the user's own question can request visualization. The generated plan may contain
    # words like "trend", "compare", "by", or "breakdown" for normal tabular analysis.
    wants_visualization = _detect_visualization_keywords(user_query)

    if not wants_visualization:
        logger.info("[VISUALIZATION PLANNER] No visualization keywords detected in query or plan.")
        return {
            **stage_update("visualization_planner"),
            "visualization_request": False,
            "visualization_type": "",
            "visualization_spec": {},
            "has_visualization": False,
            "visualization_error": "",
        }

    # Use LLM to determine visualization type and specification
    prompt_template = _get_visualization_prompt()
    
    if prompt_template:
        prompt = prompt_template.format(
            user_query=user_query,
            plan=plan,
            schema_summary=schema_summary,
        )
    else:
        prompt = f"""User Request: {user_query}

Analysis Plan: {plan}

Schema: {schema_summary}

Based on this request and plan, determine if a visualization is needed and what type of chart would be best.
Return ONLY JSON with no other text."""

    messages = [
        {
            "role": "system",
            "content": VISUALIZATION_PLANNER_SYSTEM_PROMPT,
        },
        {
            "role": "user",
            "content": prompt,
        },
    ]

    logger.info("[VISUALIZATION PLANNER] Invoking LLM to determine visualization specifications.")
    response = llm.get_response(messages).strip()
    logger.debug(f"[VISUALIZATION PLANNER] LLM Response: {response}")

    visualization_spec = _parse_visualization_spec(response)

    needs_viz = visualization_spec.get("needs_visualization", False)
    chart_type = visualization_spec.get("chart_type", "").lower()

    if not needs_viz:
        logger.info("[VISUALIZATION PLANNER] LLM determined visualization not needed.")
        main_logger.info(f"[VISUALIZATION PLANNER] Visualization not needed. Reason: {visualization_spec.get('reasoning', '')}")
        return {
            **stage_update("visualization_planner"),
            "visualization_request": False,
            "visualization_type": "",
            "visualization_spec": {},
            "has_visualization": False,
            "visualization_error": "",
        }

    # Validate chart type
    valid_types = ["bar", "line", "pie", "scatter", "heatmap", "box", "histogram", "area", "stacked_bar", "stacked_area","gauge"]
    if chart_type not in valid_types:
        logger.warning(f"[VISUALIZATION PLANNER] Invalid chart type: {chart_type}. Defaulting to 'bar'.")
        chart_type = "bar"

    logger.info(f"[VISUALIZATION PLANNER] Visualization planned: type={chart_type}, title={visualization_spec.get('title', '')}")
    main_logger.info(f"[VISUALIZATION PLANNER] Visualization Spec: {json.dumps(visualization_spec)}")
    
    elapsed_time = time.time() - start_time
    logger.info("================= [VISUALIZATION PLANNER] Completed =================, time_taken=%.3fs", elapsed_time)

    return {
        **stage_update("visualization_planner"),
        "visualization_request": True,
        "visualization_type": chart_type,
        "visualization_spec": visualization_spec,
        "has_visualization": False,  # Will be set to True after execution
        "visualization_error": "",
    }
