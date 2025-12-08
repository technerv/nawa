#!/bin/sh
set -e

# Wait for Postgres
if [ -n "$DB_HOST" ]; then
  echo "Waiting for database $DB_HOST:$DB_PORT..."
  until nc -z "$DB_HOST" "${DB_PORT:-5432}"; do
    sleep 1
  done
fi

echo "Applying migrations..."
python manage.py migrate --noinput

echo "Collecting static files..."
python manage.py collectstatic --noinput

echo "Starting ASGI server..."
exec gunicorn -k uvicorn.workers.UvicornWorker core.asgi:application --bind 0.0.0.0:8000 --workers 3

