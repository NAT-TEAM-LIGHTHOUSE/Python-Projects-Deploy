#!/bin/bash

echo "Starting CSV Scheduler..."
python /app/backend/csv_schedular/ora_csv_scheduler.py &

echo "Starting Backend..."
exec python /app/backend/app.py
