# Worker helper scripts

This folder contains convenience scripts to start/stop Redis and Celery for local development.

- `start_workers.sh` — starts Redis (Homebrew service or `redis-server`) and starts Celery worker and beat using the project's `env` virtualenv. Logs are written to your home directory as `~/nawa_celery_worker.log`, `~/nawa_celery_beat.log`, and `~/nawa_redis.log` (when redis is started directly).
- `stop_workers.sh` — stops Celery processes and stops Redis via Homebrew if available.

Usage example:

```bash
# from project root
./scripts/start_workers.sh
# inspect logs
tail -f ~/nawa_celery_worker.log ~/nawa_celery_beat.log

# later stop
./scripts/stop_workers.sh
```

Notes:
- The scripts assume a virtualenv at `env/` in the project root. If your environment is elsewhere, edit `start_workers.sh` and set `VENV` accordingly.
- On macOS it's recommended to run Redis via `brew services start redis` for a persistent background service.
