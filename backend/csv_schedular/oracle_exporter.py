import csv
import os
import time
from datetime import datetime
from pathlib import Path

import cx_Oracle

try:
    from .config import (
        DB_CONFIG,
        FETCH_BATCH_SIZE,
        ORACLE_ARRAY_SIZE,
        ORACLE_PREFETCH_ROWS,
        PROGRESS_INTERVAL_ROWS,
        logger,
        validate_view_name,
    )
    from .storage import (
        backup_existing_stable_csv,
        build_dated_csv_file_path,
        build_stable_csv_file_path,
        cleanup_old_backups,
        promote_dated_csv_to_stable,
    )
except ImportError:
    from config import (
        DB_CONFIG,
        FETCH_BATCH_SIZE,
        ORACLE_ARRAY_SIZE,
        ORACLE_PREFETCH_ROWS,
        PROGRESS_INTERVAL_ROWS,
        logger,
        validate_view_name,
    )
    from storage import (
        backup_existing_stable_csv,
        build_dated_csv_file_path,
        build_stable_csv_file_path,
        cleanup_old_backups,
        promote_dated_csv_to_stable,
    )


def get_connection():
    dsn = cx_Oracle.makedsn(
        DB_CONFIG["host"],
        DB_CONFIG["port"],
        sid=DB_CONFIG["sid"],
    )

    return cx_Oracle.connect(
        user=DB_CONFIG["user"],
        password=DB_CONFIG["password"],
        dsn=dsn,
    )


def configure_cursor(cursor):
    cursor.arraysize = ORACLE_ARRAY_SIZE
    cursor.prefetchrows = ORACLE_PREFETCH_ROWS


def write_rows_to_csv(cursor, csv_writer, view_name):
    total_rows = 0
    next_progress_log = PROGRESS_INTERVAL_ROWS
    fetch_seconds = 0.0
    write_seconds = 0.0

    while True:
        fetch_started_at = time.perf_counter()
        rows = cursor.fetchmany(FETCH_BATCH_SIZE)
        fetch_seconds += time.perf_counter() - fetch_started_at

        if not rows:
            break

        write_started_at = time.perf_counter()
        csv_writer.writerows(rows)
        write_seconds += time.perf_counter() - write_started_at
        total_rows += len(rows)

        if total_rows >= next_progress_log:
            total_stream_seconds = fetch_seconds + write_seconds
            logger.info(
                "Export progress | view=%s | rows=%s | oracle_fetch_seconds=%.2f | csv_write_seconds=%.2f | stream_seconds=%.2f",
                view_name,
                total_rows,
                fetch_seconds,
                write_seconds,
                total_stream_seconds,
            )
            next_progress_log += PROGRESS_INTERVAL_ROWS

    return total_rows, fetch_seconds, write_seconds


def restore_previous_csv(view_name, backup_csv_file, stable_csv_file):
    if backup_csv_file is None or not backup_csv_file.exists():
        return

    os.replace(backup_csv_file, stable_csv_file)
    logger.warning(
        "Previous CSV restored after promotion failure | view=%s | latest=%s",
        view_name,
        stable_csv_file,
    )


def export_view_to_csv(view_name):
    validate_view_name(view_name)

    connection = None
    cursor = None
    export_timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    stable_csv_file = build_stable_csv_file_path(view_name)
    dated_csv_file = build_dated_csv_file_path(view_name, export_timestamp)
    temp_csv_file = Path(f"{dated_csv_file}.tmp")
    started_at = datetime.now()
    export_completed = False
    backup_csv_file = None

    try:
        logger.info("Connecting Oracle DB | view=%s", view_name)
        connection = get_connection()
        cursor = connection.cursor()
        configure_cursor(cursor)

        query = f"SELECT * FROM {view_name}"
        logger.info(
            "Executing export query | view=%s | arraysize=%s | prefetchrows=%s | batch_size=%s",
            view_name,
            cursor.arraysize,
            cursor.prefetchrows,
            FETCH_BATCH_SIZE,
        )
        execute_started_at = time.perf_counter()
        cursor.execute(query)
        execute_seconds = time.perf_counter() - execute_started_at
        logger.info(
            "Oracle query executed | view=%s | execute_seconds=%.2f",
            view_name,
            execute_seconds,
        )

        column_names = [column[0] for column in cursor.description]

        with open(temp_csv_file, "w", newline="", encoding="utf-8") as csv_output:
            csv_writer = csv.writer(csv_output)
            header_write_started_at = time.perf_counter()
            csv_writer.writerow(column_names)
            header_write_seconds = time.perf_counter() - header_write_started_at
            total_rows, fetch_seconds, write_seconds = write_rows_to_csv(
                cursor,
                csv_writer,
                view_name,
            )

        os.replace(temp_csv_file, dated_csv_file)
        backup_csv_file = backup_existing_stable_csv(
            view_name,
            stable_csv_file,
            export_timestamp,
        )

        try:
            promote_dated_csv_to_stable(view_name, dated_csv_file, stable_csv_file)
        except Exception:
            restore_previous_csv(view_name, backup_csv_file, stable_csv_file)
            raise

        cleanup_old_backups(view_name)
        export_completed = True

        elapsed_seconds = (datetime.now() - started_at).total_seconds()
        logger.info(
            "CSV exported successfully | view=%s | rows=%s | total_seconds=%.2f | execute_seconds=%.2f | oracle_fetch_seconds=%.2f | csv_write_seconds=%.2f | header_write_seconds=%.4f | file=%s",
            view_name,
            total_rows,
            elapsed_seconds,
            execute_seconds,
            fetch_seconds,
            write_seconds,
            header_write_seconds,
            stable_csv_file,
        )

    except cx_Oracle.DatabaseError:
        logger.exception("Oracle export failed | view=%s", view_name)

    except Exception:
        logger.exception("CSV export failed | view=%s", view_name)
    finally:
        if cursor is not None:
            try:
                cursor.close()
            except Exception:
                logger.exception("Failed to close Oracle cursor | view=%s", view_name)

        if connection is not None:
            try:
                connection.close()
                logger.info("Oracle connection closed | view=%s", view_name)
            except Exception:
                logger.exception("Failed to close Oracle connection | view=%s", view_name)

        if not export_completed and temp_csv_file.exists():
            try:
                temp_csv_file.unlink()
            except Exception:
                logger.exception("Failed to remove incomplete CSV | file=%s", temp_csv_file)

        if not export_completed and dated_csv_file.exists():
            try:
                dated_csv_file.unlink()
            except Exception:
                logger.exception("Failed to remove incomplete dated CSV | file=%s", dated_csv_file)
