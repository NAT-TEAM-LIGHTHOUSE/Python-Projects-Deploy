import threading
from datetime import datetime

import uvicorn
from apscheduler.schedulers.background import BackgroundScheduler
from fastapi import FastAPI

try:
    from .config import FETCH_INTERVAL_HOURS, VIEWS, logger
    from .oracle_exporter import export_view_to_csv
    from .storage import create_output_directories
except ImportError:
    from config import FETCH_INTERVAL_HOURS, VIEWS, logger
    from oracle_exporter import export_view_to_csv
    from storage import create_output_directories

app = FastAPI(title="Oracle CSV Scheduler")

scheduler_lock = threading.Lock()
scheduled_job = None


def log_next_scheduler_run():
    next_run_time = getattr(scheduled_job, "next_run_time", None)

    if next_run_time is None:
        logger.info("Next scheduler run time is not available yet")
        return

    logger.info("NEXT SCHEDULER RUN : %s", next_run_time)


def run_scheduler_job():
    if not scheduler_lock.acquire(blocking=False):
        logger.warning("Scheduler job skipped because previous export is still running")
        log_next_scheduler_run()
        return

    try:
        logger.info("===================================================")
        logger.info("SCHEDULER STARTED : %s", datetime.now())
        logger.info("===================================================")

        for view_name in VIEWS.keys():
            export_view_to_csv(view_name)

        logger.info("===================================================")
        logger.info("SCHEDULER COMPLETED")
        log_next_scheduler_run()
        logger.info("===================================================")

    finally:
        scheduler_lock.release()


def start_scheduler_thread():
    thread = threading.Thread(target=run_scheduler_job, daemon=True)
    thread.start()
    return thread


create_output_directories()

scheduler = BackgroundScheduler()
scheduled_job = scheduler.add_job(
    run_scheduler_job,
    "interval",
    hours=FETCH_INTERVAL_HOURS,
    max_instances=1,
    coalesce=True,
)
scheduler.start()


@app.on_event("startup")
def startup_event():
    logger.info("FastAPI Application Started")
    start_scheduler_thread()


@app.get("/")
def health_check():
    return {
        "status": "running",
        "message": "Oracle CSV Scheduler Running",
    }


@app.get("/run-now")
def run_now():
    start_scheduler_thread()

    return {
        "status": "success",
        "message": "Scheduler Triggered Manually",
    }


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8080)
