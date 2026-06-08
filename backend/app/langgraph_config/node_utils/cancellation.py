"""
Cancellation utilities for LangGraph nodes.
Provides functions to check and handle client cancellation requests.
"""

from app.langgraph_config.state.state import State
from utils.configure import main_logger


def check_cancellation(state: State) -> bool:
    """
    Check if the client has requested cancellation.
    
    Args:
        state: LangGraph State object
        
    Returns:
        bool: True if cancellation was requested, False otherwise
    """
    should_cancel = state.get("should_cancel", False)
    if should_cancel:
        main_logger.info(f"Cancellation detected for session {state.get('session_id')}")
    return should_cancel


def handle_cancellation(state: State, stage_name: str) -> dict:
    """
    Handle cancellation by returning early with a cancellation status.
    Call this when cancellation is detected.
    
    Args:
        state: LangGraph State object
        stage_name: Name of the stage being cancelled
        
    Returns:
        dict: State update with cancellation status
    """
    main_logger.info(f"Stage '{stage_name}' cancelled for session {state.get('session_id')}")
    return {
        "status": "cancelled",
        "final_answer": "Request was cancelled by user.",
        "current_stage": stage_name,
    }
