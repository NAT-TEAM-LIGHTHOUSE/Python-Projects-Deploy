import os
from datetime import datetime, timedelta

try:
    from .config import BACKUP_RETENTION_DAYS, BASE_OUTPUT_FOLDER, VIEWS, logger
except ImportError:
    from config import BACKUP_RETENTION_DAYS, BASE_OUTPUT_FOLDER, VIEWS, logger


def create_output_directories():
    BASE_OUTPUT_FOLDER.mkdir(parents=True, exist_ok=True)

    for view_name in VIEWS.keys():
        get_view_output_folder(view_name)


def get_view_output_folder(view_name):
    view_output_folder = BASE_OUTPUT_FOLDER / view_name
    view_output_folder.mkdir(parents=True, exist_ok=True)
    return view_output_folder


def build_stable_csv_file_path(view_name):
    return get_view_output_folder(view_name) / f"{view_name}.csv"


def build_dated_csv_file_path(view_name, export_timestamp):
    return get_view_output_folder(view_name) / f"{view_name}_{export_timestamp}.csv"


def get_backup_folder(view_name, backup_timestamp):
    backup_date = backup_timestamp[:8]
    backup_folder = get_view_output_folder(view_name) / "backup" / backup_date
    backup_folder.mkdir(parents=True, exist_ok=True)
    return backup_folder


def build_backup_csv_file_path(view_name, backup_timestamp):
    return get_backup_folder(view_name, backup_timestamp) / f"{view_name}_{backup_timestamp}.csv"


def backup_existing_stable_csv(view_name, stable_csv_file, backup_timestamp):
    if not stable_csv_file.exists():
        return None

    backup_csv_file = build_backup_csv_file_path(view_name, backup_timestamp)
    os.replace(stable_csv_file, backup_csv_file)
    logger.info(
        "Existing CSV moved to backup | view=%s | backup=%s",
        view_name,
        backup_csv_file,
    )
    return backup_csv_file


def promote_dated_csv_to_stable(view_name, dated_csv_file, stable_csv_file):
    os.replace(dated_csv_file, stable_csv_file)
    logger.info(
        "New CSV promoted as latest | view=%s | latest=%s",
        view_name,
        stable_csv_file,
    )


def cleanup_old_backups(view_name):
    backup_root = get_view_output_folder(view_name) / "backup"

    if not backup_root.exists():
        return

    cutoff_date = (datetime.now() - timedelta(days=BACKUP_RETENTION_DAYS)).date()
    deleted_files = 0
    deleted_folders = 0

    for backup_folder in backup_root.iterdir():
        if not backup_folder.is_dir():
            continue

        try:
            backup_folder_date = datetime.strptime(backup_folder.name, "%Y%m%d").date()
        except ValueError:
            continue

        if backup_folder_date >= cutoff_date:
            continue

        for backup_file in backup_folder.glob("*.csv"):
            backup_file.unlink()
            deleted_files += 1

        try:
            backup_folder.rmdir()
            deleted_folders += 1
        except OSError:
            logger.warning(
                "Backup folder not empty after cleanup | view=%s | folder=%s",
                view_name,
                backup_folder,
            )

    if deleted_files or deleted_folders:
        logger.info(
            "Old backups deleted | view=%s | files=%s | folders=%s | retention_days=%s",
            view_name,
            deleted_files,
            deleted_folders,
            BACKUP_RETENTION_DAYS,
        )
