def is_error_message(answer: str) -> bool:
    """Check if the answer contains technical error messages that should be hidden from users."""
    if not answer or not isinstance(answer, str):
        return False
    
    error_indicators = [
        "SyntaxError",
        "Error:",
        "API error:",
        "Anthropic API error:",
        "OpenAI API error:",
        "authentication_error",
        "invalid x-api-key",
        "Unable to complete the analysis",
        "File \"",
        "line 3",
        "Traceback",
    ]
    
    return any(indicator in answer for indicator in error_indicators)

def get_friendly_error_message() -> str:
    """Return a user-friendly error message."""
    return "Our service is temporarily unavailable. Please try again later."