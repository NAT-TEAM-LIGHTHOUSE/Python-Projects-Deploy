from typing import Annotated, Any, Dict, List, Optional
from typing_extensions import TypedDict
from langgraph.graph.message import add_messages

############ State Definition ############
class State(TypedDict, total=False):
    session_id: str
    user_query: str

    table_data: Any
    table_info: Any
    custom_prompt: Optional[str]
    ai_prompt: Optional[str]

    chat_history: List[Dict[str, str]]

    session_dir: str
    table_file_path: str
    table_file_name: str
    dataset_available: bool
    error_message: str

    schema_summary: str
    table_preview: str

    intent: str
    intent_reason: str

    plan: str
    retry_count: int
    generated_code: str
    fixed_code: str
    execution_output: str
    execution_error: str

    final_answer: str
    status: str
    
    current_stage: str
    current_stage_label: str
    
    # Client cancellation flag
    should_cancel: bool
    
    # Visualization fields
    visualization_request: bool
    visualization_type: str
    visualization_spec: Optional[Dict[str, Any]]
    has_visualization: bool
    visualization_error: str

