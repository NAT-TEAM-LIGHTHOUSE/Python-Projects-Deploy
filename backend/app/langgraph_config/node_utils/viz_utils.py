from typing import Any, Dict, List, Tuple
import re

#### Utility functions for visualization handling in the sandbox executor node.
def _extract_between_markers(text: str, start_marker: str, end_marker: str) -> str:
    """Extract content between start and end markers"""
    start_idx = text.find(start_marker)
    if start_idx == -1:
        return ""
    
    start_idx += len(start_marker)
    end_idx = text.find(end_marker, start_idx)
    if end_idx == -1:
        return ""
    
    return text[start_idx:end_idx].strip()

def _extract_all_between_markers(text: str, start_marker: str, end_marker: str) -> List[str]:
    pattern = re.compile(
        f"{re.escape(start_marker)}(.*?){re.escape(end_marker)}",
        flags=re.DOTALL,
    )
    return [match.strip() for match in pattern.findall(text) if match.strip()]

def parse_visualization_output(stdout: str) -> Tuple[str, List[str], str]:
    """
    Parse execution output to extract:
    1. Visualization JSON blocks (between <PLOTLY_JSON> markers)
    2. Data table (between <DATA_TABLE_START> markers)
    3. Remaining output
    
    Returns: (table_output, visualization_json_blocks, remaining_output)
    """
    # Extract all visualization JSON blocks
    viz_json_blocks = _extract_all_between_markers(stdout, "<PLOTLY_JSON>", "</PLOTLY_JSON>")
    
    # Extract data table
    table_output = _extract_between_markers(stdout, "<DATA_TABLE_START>", "<DATA_TABLE_END>")
    
    # Remove markers from output to get clean remaining output
    remaining = stdout
    if viz_json_blocks:
        remaining = re.sub(r"<PLOTLY_JSON>.*?</PLOTLY_JSON>", "", remaining, flags=re.DOTALL)
    if table_output:
        remaining = re.sub(r"<DATA_TABLE_START>.*?<DATA_TABLE_END>", "", remaining, flags=re.DOTALL)
    
    remaining = remaining.strip()
    
    return table_output, viz_json_blocks, remaining
