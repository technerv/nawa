#!/usr/bin/env bash
set -euo pipefail

# Stop helper for Redis + Celery (local development)
# Usage: ./scripts/stop_workers.sh

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PID_DIR="$PROJECT_ROOT/tmp/pids"
WORKER_PIDFILE="$PID_DIR/celery_worker.pid"
BEAT_PIDFILE="$PID_DIR/celery_beat.pid"

stop_if_pidfile() {
  local pidfile="$1"; shift
  if [ -f "$pidfile" ]; then
    pid=$(cat "$pidfile" 2>/dev/null || true)
    if [ -n "$pid" ]; then
      echo "Stopping pid $pid from $pidfile"
      kill "$pid" 2>/dev/null || true
      # wait briefly
      sleep 1
      if kill -0 "$pid" >/dev/null 2>&1; then
        echo "Pid $pid still alive; sending TERM"
        kill -TERM "$pid" 2>/dev/null || true
        sleep 1
      fi
    fi
    rm -f "$pidfile" || true
  else
    echo "No pidfile $pidfile"
  fi
}

echo "Stopping Celery worker/beat using pidfiles if present..."
stop_if_pidfile "$WORKER_PIDFILE"
stop_if_pidfile "$BEAT_PIDFILE"

echo "Fallback: kill any remaining celery processes..."
pkill -f "celery" || true

echo "Stopping Redis via Homebrew if available..."
if command -v brew >/dev/null 2>&1; then
  brew services stop redis || true
fi

echo "Stopped."
