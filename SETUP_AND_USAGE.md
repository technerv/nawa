# NAWA Setup and Usage Guide

## 🚀 Quick Start

### 1. Login Access

**Both dashboards use the same login page:**
- Navigate to: `http://localhost:5173/login` (or your frontend URL)
- Enter username and password
- System automatically routes you to the correct dashboard based on your role

**Dashboard Routing:**
- **SuperAdmin** → Super Admin Dashboard (`/dashboard`)
- **SecurityOrgUser** → Security Dashboard (`/dashboard`)
- **Other roles** → Default Dashboard (`/dashboard`)

### 2. Creating Accounts

#### Create SuperAdmin (First Time Setup)

**Method 1: Django Admin (Recommended)**
```bash
cd core
python manage.py createsuperuser
# Enter: username, email, password

# Then in Django Admin (http://127.0.0.1:8000/admin/):
# 1. Go to Users → Select your user
# 2. In "Groups" section, add "SuperAdmin" group
# 3. Save
```

**Method 2: Python Shell**
```python
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

User = get_user_model()
user = User.objects.create_user(
    username='superadmin',
    password='your_secure_password',
    email='admin@nawa.local'
)
superadmin_group, _ = Group.objects.get_or_create(name='SuperAdmin')
user.groups.add(superadmin_group)
user.is_staff = True
user.is_superuser = True
user.save()
```

#### Create Security Org Users

**Via App (SuperAdmin Only):**
1. Login as SuperAdmin
2. Navigate to `/admin/users`
3. Click "+ Create User"
4. Fill in the form:
   - Username, Password, Email
   - Organization Name (required)
   - Organization Type
   - Contact info, IP/VPN restrictions (optional)
5. Click "Create User"
6. User account and whitelist entry are created automatically

### 3. Installing Dependencies

**Backend:**
```bash
cd core
pip install -r requirements.txt
# Installs: channels, channels-redis, django, etc.
```

**Frontend:**
```bash
cd frontend
npm install
# Installs: recharts, jspdf, html2canvas, jszip, etc.
```

### 4. Setting Up Redis (for WebSocket)

**Install Redis:**
```bash
# macOS
brew install redis

# Linux (Ubuntu/Debian)
sudo apt-get install redis-server

# Or use Docker
docker run -d -p 6379:6379 redis:latest
```

**Start Redis:**
```bash
redis-server
# Or with Docker: docker start <container_id>
```

**Environment Variables:**
Add to `core/.env`:
```env
REDIS_HOST=localhost
REDIS_PORT=6379
```

### 5. Running Migrations

```bash
cd core
python manage.py migrate
```

### 6. Starting the Application

**Backend (with WebSocket support):**
```bash
cd core
# Using uvicorn (recommended - supports WebSocket)
uvicorn core.asgi:application --reload --host 0.0.0.0 --port 8000

# Or using Django runserver (WebSocket may not work)
python manage.py runserver
```

**Frontend:**
```bash
cd frontend
npm run dev
```

## 📋 Feature Usage

### WebSocket Real-Time Alerts

**How it works:**
- Security Dashboard automatically connects to WebSocket on load
- New reports trigger real-time notifications
- Connection status shown in dashboard header (green dot = connected, red = disconnected)
- Falls back to polling (10s intervals) if WebSocket unavailable

**Testing:**
1. Open Security Dashboard in one browser tab
2. Create a new report (public or private)
3. Alert should appear immediately in Security Dashboard
4. Check connection indicator (top-right of dashboard)

### Export Case Packages

**How to use:**
1. Navigate to `/reports`
2. Find the report you want to export
3. Click "📦 Export" button in the "Moderate" column
4. ZIP file downloads with:
   - OB-compatible PDF report
   - Evidence files (photos, videos, audio)
   - Metadata JSON

**What's included:**
- PDF: OB number, crime details, location, witnesses, audit log
- Evidence: All photos, videos, and audio files
- Metadata: Report ID, generation timestamp, system version

### Analytics Models

**Access:**
- Super Admin Dashboard → Analytics Models section

**Available Models:**
1. **Severity** - Distribution pie chart
2. **False Detection** - Suspicious report analysis
3. **Hotspot** - High-incident location identification
4. **Performance** - Response time and SLA compliance charts
5. **Monetization** - Cost/revenue/ROI analysis

**Date Filtering:**
- Use date range inputs above Analytics Models section
- Filters apply to all analytics queries
- Click "Clear Filter" to reset

### Triage Rule Configuration

**Access:**
- Super Admin Dashboard → "Manage Rules" button
- Or navigate to `/admin/triage`

**Features:**
- Create new triage rules
- Edit existing rules
- Set severity thresholds (0-100)
- County-specific rules
- Enable/disable rules

## 🔧 Configuration Files

### Backend Configuration

**`core/core/settings.py`:**
- `CHANNEL_LAYERS` - Redis configuration for WebSocket
- `ASGI_APPLICATION` - ASGI routing
- `INSTALLED_APPS` - Includes 'channels'

**`core/nawaapp/routing.py`:**
- WebSocket URL patterns
- Routes: `/ws/alerts/`, `/ws/alerts/{org_id}/`

**`core/nawaapp/consumers.py`:**
- WebSocket consumers
- JWT authentication
- Message handling

### Frontend Configuration

**`frontend/src/hooks/useWebSocket.ts`:**
- WebSocket connection hook
- Auto-reconnection logic
- Message handling

**`frontend/src/lib/export.ts`:**
- PDF generation
- ZIP file creation
- Case package assembly

## 🐛 Troubleshooting

### WebSocket Not Connecting

**Symptoms:**
- Dashboard shows "Polling" instead of "Live"
- Red dot in connection indicator

**Solutions:**
1. Check Redis is running: `redis-cli ping` (should return "PONG")
2. Verify Redis host/port in settings
3. Check browser console for WebSocket errors
4. Ensure backend is running with uvicorn (not runserver)
5. Check CORS settings allow WebSocket connections

### Export Not Working

**Symptoms:**
- Export button doesn't download file
- Error message in console

**Solutions:**
1. Check browser allows downloads
2. Verify evidence file URLs are accessible
3. Check browser console for errors
4. Ensure report data is complete

### Analytics Not Loading

**Symptoms:**
- Charts don't appear
- "No data" messages

**Solutions:**
1. Check date range filters
2. Verify backend endpoint is accessible
3. Check browser console for API errors
4. Ensure you're logged in as SuperAdmin

### Can't Access Dashboard

**Symptoms:**
- Redirected to wrong dashboard
- "Access denied" message

**Solutions:**
1. Check user's groups in Django Admin
2. Verify "SuperAdmin" or "SecurityOrgUser" group is assigned
3. Clear browser localStorage: `localStorage.clear()` in console
4. Logout and login again

## 📊 API Endpoints Reference

### Stats & Analytics
- `GET /api/crimereportbook/stats/` - Security Org stats
- `GET /api/admin/global_stats/` - SuperAdmin global stats
- `GET /api/admin/org_performance/?date_from={date}&date_to={date}` - Org performance
- `GET /api/admin/analytics/?model={type}&date_from={date}&date_to={date}` - Analytics models

### Triage
- `GET /api/admin/triage_rules/` - List triage rules
- `POST /api/admin/triage_rules/` - Create triage rule

### WebSocket
- `ws://localhost:8000/ws/alerts/?token={jwt_token}` - All alerts
- `ws://localhost:8000/ws/alerts/{org_id}/?token={jwt_token}` - Org-specific

## 🎯 Testing Checklist

- [ ] SuperAdmin can login and see Super Admin Dashboard
- [ ] Security Org User can login and see Security Dashboard
- [ ] WebSocket connects (green dot in Security Dashboard)
- [ ] New reports trigger WebSocket notifications
- [ ] Export button downloads ZIP file
- [ ] Analytics models display data
- [ ] Date filters work in analytics
- [ ] Triage rules can be created/edited
- [ ] Charts render correctly
- [ ] All API endpoints return data

## 📝 Notes

- WebSocket requires Redis - system falls back to polling if unavailable
- Export requires evidence files to be accessible via URLs
- Analytics models use simplified algorithms (can be enhanced with ML)
- Date filters apply to all analytics queries
- Triage rules are currently stored in-memory (should be persisted to database in production)

