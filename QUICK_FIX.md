# Quick Fix: Install Channels

## The Issue
`ModuleNotFoundError: No module named 'channels'` means Django Channels is not installed in your Python environment.

## Solution

**You have a virtual environment at `core/venv/`. Activate it and install:**

```bash
cd core

# Activate virtual environment
source venv/bin/activate

# Install channels
pip install channels channels-redis

# Verify installation
python -c "import channels; print('Channels version:', channels.__version__)"
```

## Alternative: Install All Requirements

```bash
cd core
source venv/bin/activate
pip install -r requirements.txt
```

This will install channels along with all other dependencies.

## After Installation

1. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

2. **Start server with WebSocket support:**
   ```bash
   uvicorn core.asgi:application --reload --port 8000
   ```

## If You Don't Want WebSocket Right Now

You can temporarily disable WebSocket by commenting out in `core/core/settings.py`:

```python
# INSTALLED_APPS = [
#     ...
#     # 'channels',  # Comment this out
# ]

# ASGI_APPLICATION = 'core.asgi.application'  # Comment this out
```

The system will automatically fall back to polling (10-second intervals) for real-time updates.

## Verify It Works

After installing, test:
```bash
cd core
source venv/bin/activate
python manage.py check
```

If no errors, channels is installed correctly!

