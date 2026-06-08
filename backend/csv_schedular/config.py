import logging
import re
import sys
from datetime import datetime
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parents[1]
DB_PROPERTIES_PATH = BASE_DIR / "db.properties"
BASE_OUTPUT_FOLDER = BASE_DIR / "TableGpt_Plus"
SCHEDULAR_LOG_FOLDER = BASE_DIR / "schedular_logs"

DB_PROPERTY_KEYS = {
    "DB_USERNAME",
    "DB_PASSWORD",
    "DB_PORT",
    "DB_HOST",
    "SID_NAME",
    "FETCH_INTERVAL_HOURS",
    "ORACLE_FETCH_BATCH_SIZE",
    "ORACLE_ARRAY_SIZE",
    "ORACLE_PREFETCH_ROWS",
    "EXPORT_PROGRESS_INTERVAL_ROWS",
}

DEFAULT_FETCH_BATCH_SIZE = 50000
DEFAULT_ARRAY_SIZE = 50000
DEFAULT_PREFETCH_ROWS = 50000
DEFAULT_PROGRESS_INTERVAL_ROWS = 100000
BACKUP_RETENTION_DAYS = 3

ORACLE_IDENTIFIER_PATTERN = re.compile(
    r"^[A-Za-z][A-Za-z0-9_$#]*(\.[A-Za-z][A-Za-z0-9_$#]*)?$"
)


class DateWiseSchedulerFileHandler(logging.Handler):
    def __init__(self, log_folder):
        super().__init__()
        self.log_folder = log_folder
        self.current_log_date = None
        self.current_log_file_path = None
        self.current_file = None

    def emit(self, record):
        try:
            log_date = datetime.fromtimestamp(record.created).strftime("%Y-%m-%d")
            self._open_log_file(log_date)
            self.current_file.write(f"{self.format(record)}\n")
            self.current_file.flush()
        except Exception:
            self.handleError(record)

    def open_today_log_file(self):
        log_date = datetime.now().strftime("%Y-%m-%d")
        self._open_log_file(log_date)

    def close(self):
        if self.current_file is not None:
            self.current_file.close()
            self.current_file = None

        super().close()

    def _open_log_file(self, log_date):
        if self.current_log_date == log_date and self.current_file is not None:
            return

        if self.current_file is not None:
            self.current_file.close()

        self.log_folder.mkdir(parents=True, exist_ok=True)
        log_file_path = self.log_folder / f"schedular_{log_date}.log"
        self.current_file = open(log_file_path, "a", encoding="utf-8", buffering=1)
        self.current_log_date = log_date
        self.current_log_file_path = log_file_path


def configure_scheduler_logger():
    SCHEDULAR_LOG_FOLDER.mkdir(parents=True, exist_ok=True)

    scheduler_logger = logging.getLogger("oracle_csv_scheduler")
    scheduler_logger.setLevel(logging.INFO)
    for handler in scheduler_logger.handlers:
        handler.close()

    scheduler_logger.handlers = []
    scheduler_logger.propagate = False

    formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(threadName)s | %(message)s"
    )

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    scheduler_logger.addHandler(console_handler)

    file_handler = DateWiseSchedulerFileHandler(SCHEDULAR_LOG_FOLDER)
    file_handler.setFormatter(formatter)
    file_handler.open_today_log_file()
    scheduler_logger.addHandler(file_handler)

    scheduler_logger.info(
        "Scheduler log file initialized | file=%s",
        file_handler.current_log_file_path,
    )

    return scheduler_logger


logger = configure_scheduler_logger()


def load_properties(file_path):
    properties = {}

    with open(file_path, "r", encoding="utf-8") as property_file:
        for line in property_file:
            line = line.strip()

            if not line or line.startswith("#") or "=" not in line:
                continue

            key, value = line.split("=", 1)
            properties[key.strip()] = value.strip()

    return properties


def parse_int_property(properties, key, default_value):
    value = properties.get(key)

    if value is None or str(value).strip() == "":
        return default_value

    return int(str(value).strip().split()[0])


def validate_view_name(view_name):
    if not ORACLE_IDENTIFIER_PATTERN.match(view_name):
        raise ValueError(f"Invalid Oracle view name configured: {view_name}")


properties = load_properties(DB_PROPERTIES_PATH)

DB_CONFIG = {
    "user": properties["DB_USERNAME"],
    "password": properties["DB_PASSWORD"],
    "host": properties["DB_HOST"],
    "port": int(properties["DB_PORT"]),
    "sid": properties["SID_NAME"],
}

VIEWS = {
    key: value
    for key, value in properties.items()
    if key not in DB_PROPERTY_KEYS
}

FETCH_INTERVAL_HOURS = parse_int_property(properties, "FETCH_INTERVAL_HOURS", 1)
FETCH_BATCH_SIZE = parse_int_property(
    properties,
    "ORACLE_FETCH_BATCH_SIZE",
    DEFAULT_FETCH_BATCH_SIZE,
)
ORACLE_ARRAY_SIZE = parse_int_property(
    properties,
    "ORACLE_ARRAY_SIZE",
    DEFAULT_ARRAY_SIZE,
)
ORACLE_PREFETCH_ROWS = parse_int_property(
    properties,
    "ORACLE_PREFETCH_ROWS",
    DEFAULT_PREFETCH_ROWS,
)
PROGRESS_INTERVAL_ROWS = parse_int_property(
    properties,
    "EXPORT_PROGRESS_INTERVAL_ROWS",
    DEFAULT_PROGRESS_INTERVAL_ROWS,
)
