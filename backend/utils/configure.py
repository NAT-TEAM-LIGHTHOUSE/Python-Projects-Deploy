from configparser import ConfigParser
from datetime import datetime
import os
import logging
import sys
import locale

# Load properties
config = ConfigParser()

def load_config():
    global log_file_path, debug_file_path, DEBUG_FLAG, table_context_print, main_logger, debug_logger, python_code_print, execution_output
    print("Loading configuration from config.properties...")
    # Resolve paths from the backend directory so logging does not depend on
    # the process working directory used to start the app.
    backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    project_root = os.path.abspath(os.path.join(backend_dir, ".."))
    log_base_dir = os.path.join(project_root, "logs")

    # Look for config.properties in the backend directory
    config_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "config.properties"))
    print(f"Looking for config file at: {config_file}")
    print(f"File exists: {os.path.exists(config_file)}")
    read_files = config.read(config_file)
    print(f"Config read from: {read_files}")
    if not config.has_section("LOGGING"):
        print(f"ERROR: No section 'LOGGING' found in {config_file}")
        # Set defaults or raise error as needed
        raise RuntimeError("Missing 'LOGGING' section in config.properties")
    try:
        log_file_rel_path = datetime.now().strftime(config.get("LOGGING", "log_file_path"))
        debug_file_rel_path = datetime.now().strftime(config.get("LOGGING", "debug_file_path"))
        log_file_path = os.path.join(log_base_dir, log_file_rel_path)
        debug_file_path = os.path.join(log_base_dir, debug_file_rel_path)
        DEBUG_FLAG = config.getboolean("LOGGING", "DEBUG_FLAG")
        table_context_print = config.getboolean("LOGGING", "table_context_print")
        python_code_print = config.getboolean("LOGGING", "python_code_print")
        execution_output = config.getboolean("LOGGING", "execution_output")
        print(f"log_base_dir: {log_base_dir}")
        print(f"log_file_path: {log_file_path}")
        print(f"debug_file_path: {debug_file_path}")
        print(f"DEBUG_FLAG: {DEBUG_FLAG}")
        print(f"table_context_print: {table_context_print}")
        print(f"python_code_print: {python_code_print}")
        print(f"execution_output: {execution_output}")
    except Exception as e:
        print(f"ERROR reading LOGGING config: {e}")
        raise

    # Ensure the log file paths are correct
    os.makedirs(os.path.dirname(log_file_path), exist_ok=True)
    os.makedirs(os.path.dirname(debug_file_path), exist_ok=True)

    # Helper: formatter that replaces unencodable chars for console output
    class SanitizingFormatter(logging.Formatter):
        def __init__(self, fmt=None, datefmt=None, style='%'):
            super().__init__(fmt=fmt, datefmt=datefmt, style=style)

        def format(self, record: logging.LogRecord) -> str:
            msg = super().format(record)
            # Attempt to encode using the console encoding; replace unencodable characters
            enc = getattr(sys.stdout, 'encoding', None) or locale.getpreferredencoding(False) or 'utf-8'
            try:
                return msg.encode(enc, errors='replace').decode(enc, errors='replace')
            except Exception:
                # Fallback to safe UTF-8 replacement if anything odd happens
                return msg.encode('utf-8', errors='replace').decode('utf-8', errors='replace')

    # Configure the main logger to log specific details
    main_logger = logging.getLogger("main_logger")
    main_logger.setLevel(logging.INFO)
    main_logger.handlers = []  # Clear existing handlers
    # File handler with explicit UTF-8 to support emojis and non-ASCII
    main_file_handler = logging.FileHandler(log_file_path, mode='a', encoding='utf-8')
    main_logger.addHandler(main_file_handler)
    # Console handler with sanitizing formatter to avoid UnicodeEncodeError on Windows cp1252
    main_console_handler = logging.StreamHandler()
    main_console_handler.setFormatter(SanitizingFormatter('%(levelname)s:%(name)s:%(message)s'))
    main_logger.addHandler(main_console_handler)
    # Do not propagate to root to avoid duplicate logging and root handler encoding issues
    main_logger.propagate = False

    # Configure the debug logger to log all details if DEBUG_FLAG is True
    debug_logger = None
    if DEBUG_FLAG:
        debug_logger = logging.getLogger("debug_logger")
        debug_logger.setLevel(logging.DEBUG)
        debug_logger.handlers = []  # Clear existing handlers
        debug_file_handler = logging.FileHandler(debug_file_path, mode='a', encoding='utf-8')
        debug_logger.addHandler(debug_file_handler)
        debug_console_handler = logging.StreamHandler()
        debug_console_handler.setFormatter(SanitizingFormatter('%(levelname)s:%(name)s:%(message)s'))
        debug_logger.addHandler(debug_console_handler)
        debug_logger.propagate = False

    # Ensure the loggers are correctly initialized
    main_logger.info("Main logger initialized")
    if debug_logger:
        debug_logger.debug("Debug logger initialized")

# Initial load of the configuration
try:
    load_config()
except Exception as e:
    print(f"Failed to load configuration: {e}")
    raise



