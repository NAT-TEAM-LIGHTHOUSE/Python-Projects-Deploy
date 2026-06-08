import logging
import os
from datetime import datetime
import sys

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)
    ],
    force=True, 
)

def get_logger(name: str = "") -> logging.Logger:
	"""
	Returns a logger that writes to log/log_{YYYY-MM-DD}.log, rotating daily.
	Creates log directory if missing.
	"""
	log_dir = os.path.join(os.path.dirname(__file__), "..", "..", "logs")
	os.makedirs(log_dir, exist_ok=True)
	log_date = datetime.now().strftime("%Y-%m-%d")
	log_path = os.path.join(log_dir, f"log_{log_date}.log")

	logger = logging.getLogger(name)
	logger.setLevel(logging.INFO)

	# Avoid duplicate handlers
	if not any(isinstance(h, logging.FileHandler) and h.baseFilename == log_path for h in logger.handlers):
		file_handler = logging.FileHandler(log_path, encoding="utf-8")
		formatter = logging.Formatter('[%(asctime)s] %(levelname)s %(name)s: %(message)s')
		file_handler.setFormatter(formatter)
		logger.addHandler(file_handler)

	return logger
