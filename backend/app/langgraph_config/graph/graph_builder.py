import os
from dotenv import load_dotenv
from utils.logger import get_logger
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, START, StateGraph
from app.langgraph_config.state.state import State
from app.langgraph_config.nodes.session_dataset_loader import session_dataset_loader_node
from app.langgraph_config.nodes.schema_analyzer import schema_analyzer_node
from app.langgraph_config.nodes.intent_classifier import intent_classifier_node
from app.langgraph_config.nodes.qa_agent import qa_agent_node
from app.langgraph_config.nodes.data_analysis_agent import data_analysis_agent_node
from app.langgraph_config.nodes.query_planner import query_planner_node
from app.langgraph_config.nodes.visualization_planner import visualization_planner_node
from app.langgraph_config.nodes.code_generator import code_generator_node
from app.langgraph_config.nodes.sandbox_executor import sandbox_executor_node
from app.langgraph_config.nodes.response_formatter import response_formatter_node
from app.langgraph_config.nodes.error_detector import error_detector_node
from app.langgraph_config.nodes.code_fix_agent import code_fix_agent_node

load_dotenv()

logger = get_logger("langgraph.graph_builder")

is_api_env = os.getenv("LANGGRAPH_API_VERSION") is not None
_ENV = os.getenv("USE_LOCAL_CHECKPOINTER", "").lower()
_ENABLE_CP = _ENV not in ("0", "false", "no")
_USE_REDIS_CP = os.getenv("LANGGRAPH_USE_REDIS_CHECKPOINTER", "true").lower() in ("1", "true", "yes")
_REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")

try:
    from langgraph.checkpoint.redis import RedisSaver
    REDIS_SAVER_AVAILABLE = True
except Exception:
    RedisSaver = None
    REDIS_SAVER_AVAILABLE = False

_CHECKPOINTER = None
_CHECKPOINTER_CM = None

####### Helper function to build the appropriate checkpointer based on environment variables and availability of RedisSaver, with graceful fallbacks and logging
def _build_checkpointer():
    global _CHECKPOINTER, _CHECKPOINTER_CM

    if is_api_env:
        logger.info("[GRAPH BUILDER] Running in LangGraph API environment, custom checkpointer disabled")
        return None

    if _CHECKPOINTER is not None:
        return _CHECKPOINTER

    if _USE_REDIS_CP and REDIS_SAVER_AVAILABLE:
        try:
            logger.info("Trying RedisSaver checkpointer")
            _CHECKPOINTER_CM = RedisSaver.from_conn_string(_REDIS_URL)
            _CHECKPOINTER = _CHECKPOINTER_CM.__enter__()
            _CHECKPOINTER.setup()
            logger.info("[GRAPH BUILDER]RedisSaver initialized successfully")
            return _CHECKPOINTER
        except Exception as e:
            logger.warning(f"[GRAPH BUILDER] RedisSaver unavailable, falling back to MemorySaver: {e}")
            _CHECKPOINTER = None
            _CHECKPOINTER_CM = None

    if _ENABLE_CP:
        try:
            logger.info("[GRAPH BUILDER] Using MemorySaver checkpointer")
            _CHECKPOINTER = MemorySaver()
            return _CHECKPOINTER
        except Exception as e:
            logger.error(f"[GRAPH BUILDER] Failed to initialize MemorySaver: {e}")
            return None

    logger.info("[GRAPH BUILDER] Checkpointing disabled")
    return None
######### Function to determine routing after intent classification, directing to either the QA agent or the 
# Data Analysis agent based on the classified intent.
def route_after_intent(state: State) -> str:
    intent = (state.get("intent") or "qa").strip().lower()

    if intent == "analysis":
        return "data_analysis_agent"

    return "qa_agent"

def route_after_error_detection(state: State) -> str:
    status = (state.get("status") or "").strip().lower()

    if status == "execution_succeeded":
        return "response_formatter"

    if status == "execution_failed":
        return "code_fix_agent"

    if status == "max_retries_exceeded":
        return "response_formatter"

    return "response_formatter"

############################################################### Graph Builder ####################################
class GraphBuilder:
    def __init__(self, checkpointer=None):
        self.checkpointer = checkpointer
    def table_gpt_chatbot(self):
        builder = StateGraph(State)

        builder.add_node("session_dataset_loader", session_dataset_loader_node)
        builder.add_node("schema_analyzer", schema_analyzer_node)
        builder.add_node("intent_classifier", intent_classifier_node)
        builder.add_node("qa_agent", qa_agent_node)
        builder.add_node("data_analysis_agent", data_analysis_agent_node)
        builder.add_node("query_planner", query_planner_node)
        builder.add_node("visualization_planner", visualization_planner_node)
        builder.add_node("code_generator", code_generator_node)
        builder.add_node("sandbox_executor", sandbox_executor_node)
        builder.add_node("response_formatter", response_formatter_node)
        builder.add_node("error_detector", error_detector_node)
        builder.add_node("code_fix_agent", code_fix_agent_node)


        builder.add_edge(START, "session_dataset_loader")
        builder.add_edge("session_dataset_loader", "schema_analyzer")
        builder.add_edge("schema_analyzer", "intent_classifier")
        builder.add_edge("data_analysis_agent", "query_planner")

        builder.add_conditional_edges(
            "intent_classifier",
            route_after_intent,
            {
                "qa_agent": "qa_agent",
                "data_analysis_agent": "data_analysis_agent",
            },
        )

        builder.add_edge("qa_agent", END)
        builder.add_edge("query_planner", "visualization_planner")
        builder.add_edge("visualization_planner", "code_generator")
        builder.add_edge("code_generator", "sandbox_executor")
        builder.add_edge("sandbox_executor", "error_detector")
        
        builder.add_conditional_edges(
            "error_detector",
            route_after_error_detection,
            {
                "response_formatter": "response_formatter",
                "code_fix_agent": "code_fix_agent",
            },
        )

        builder.add_edge("code_fix_agent", "sandbox_executor")
        builder.add_edge("response_formatter", END)
        logger.info(f"====================== [GRAPH BUILDER] Graph construction completed =======================")

        return builder.compile(checkpointer=self.checkpointer)

_cp = _build_checkpointer()
Table_GPT = GraphBuilder(checkpointer=_cp).table_gpt_chatbot()
table_gpt_chatbot = Table_GPT