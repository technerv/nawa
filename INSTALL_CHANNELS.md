# Installing Django Channels

## Quick Install

If you're using a virtual environment (recommended):

```bash
cd core

# Activate your virtual environment first
# For venv:
source venv/bin/activate

# For conda:
# conda activate your_env_name

# Then install:
pip install channels channels-redis

# Or install all requirements:
pip install -r requirements.txt
```

## If You Don't Have a Virtual Environment

**Create one first:**

```bash
cd core

# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate  # On macOS/Linux
# OR
venv\Scripts\activate  # On Windows

# Install dependencies
pip install -r requirements.txt
```

## Verify Installation

```bash
python -c "import channels; print('Channels installed:', channels.__version__)"
```

## If You Still Get Errors

1. **Make sure you're in the virtual environment:**
   ```bash
   which python  # Should show path to venv
   ```

2. **Try installing directly:**
   ```bash
   pip install channels==4.0.0 channels-redis==4.1.0
   ```

3. **Check Python version:**
   ```bash
   python --version  # Should be Python 3.8+
   ```

4. **If using system Python, use pip3:**
   ```bash
   pip3 install channels channels-redis
   ```

## After Installation

Once channels is installed, you can:

1. **Run migrations:**
   ```bash
   python manage.py migrate
   ```

2. **Start the server with WebSocket support:**
   ```bash
   # Using uvicorn (recommended)
   uvicorn core.asgi:application --reload --port 8000
   
   # Or using daphne (alternative)
   daphne -b 0.0.0.0 -p 8000 core.asgi:application
   ```

## Note

If you don't want to use WebSocket right now, you can:
- Comment out `'channels'` in `INSTALLED_APPS` in `settings.py`
- Comment out `ASGI_APPLICATION` in `settings.py`
- The system will fall back to polling (10s intervals) automatically

But WebSocket is recommended for real-time alerts!

