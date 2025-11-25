#!/usr/bin/env bash
set -euo pipefail

# Start helper for Redis + Celery (worker + beat) for local development.
# Usage: ./scripts/start_workers.sh

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENV="$PROJECT_ROOT/env"
LOG_DIR="${HOME}"
CELERY_WORKER_LOG="$LOG_DIR/nawa_celery_worker.log"
CELERY_BEAT_LOG="$LOG_DIR/nawa_celery_beat.log"
REDIS_LOG="$LOG_DIR/nawa_redis.log"

echo "PROJECT_ROOT=$PROJECT_ROOT"

echo "Starting Redis (try Homebrew service first)..."
if command -v brew >/dev/null 2>&1; then
  brew services start redis || true
fi

if pgrep -f redis-server >/dev/null 2>&1; then
  echo "Redis already running"
else
  if command -v redis-server >/dev/null 2>&1; then
    echo "Launching redis-server in background (logs -> $REDIS_LOG)"
    # Try to use default Homebrew config path, fall back to bare server
    if [ -f /usr/local/etc/redis.conf ]; then
      redis-server /usr/local/etc/redis.conf > "$REDIS_LOG" 2>&1 &
    else
      redis-server > "$REDIS_LOG" 2>&1 &
    fi
    sleep 1
  else
    echo "redis-server not found. Install via: brew install redis" >&2
    exit 1
  fi
fi

if [ ! -x "$VENV/bin/python" ]; then
  echo "Virtualenv python not found at $VENV/bin/python" >&2
  echo "Create a venv at $VENV or adjust this script." >&2
  exit 1
fi

PYTHON="$VENV/bin/python"
export PYTHONPATH="$PROJECT_ROOT/core"

# PID files
PID_DIR="$PROJECT_ROOT/tmp/pids"
mkdir -p "$PID_DIR"
WORKER_PIDFILE="$PID_DIR/celery_worker.pid"
BEAT_PIDFILE="$PID_DIR/celery_beat.pid"

start_if_not_running() {
  local name="$1"; shift
  local pidfile="$1"; shift
  local cmd=("$@");

  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [ -n "$pid" ] && kill -0 "$pid" >/dev/null 2>&1; then
      echo "$name already running (pid $pid)"
      return 0
    else
      echo "Stale pidfile $pidfile found. Removing."
      rm -f "$pidfile" || true
    fi
  fi

  echo "Starting $name (logs -> ${CELERY_WORKER_LOG}/${CELERY_BEAT_LOG})"
  "${cmd[@]}" &
  pid=$!
  echo "$pid" > "$pidfile"
  echo "$name started with pid $pid"
}

echo "Starting Celery worker (logs -> $CELERY_WORKER_LOG)"
start_if_not_running "celery-worker" "$WORKER_PIDFILE" "$PYTHON" -m celery -A core.celery worker -l info --concurrency=1 > "$CELERY_WORKER_LOG" 2>&1

echo "Starting Celery beat (logs -> $CELERY_BEAT_LOG)"
start_if_not_running "celery-beat" "$BEAT_PIDFILE" "$PYTHON" -m celery -A core.celery beat -l info > "$CELERY_BEAT_LOG" 2>&1

echo "Started. Tail logs with: tail -f $CELERY_WORKER_LOG $CELERY_BEAT_LOG $REDIS_LOG"
