# Organization-Based Access Control Implementation

## Overview

This document describes the strict organization-based access control system implemented in NAWA to ensure complete data isolation between security organizations.

## Architecture

### Core Components

1. **`assigned_organization` Field**: Added to `CrimeReportBook` model to track which organization a report belongs to
2. **`org_access.py`**: Utility module with access control functions
3. **Query Filtering**: All database queries filter by organization
4. **WebSocket Isolation**: Organization-specific WebSocket channels
5. **API-Level Filtering**: All endpoints enforce organization boundaries

## Access Rules

### SuperAdmin
- **Can see**: All reports, all organizations, all analytics
- **WebSocket**: Connects to `alerts_all` channel (receives all alerts)
- **No restrictions**: Full system access

### Security Org Users
- **Can see**: Only reports assigned to their organization
- **WebSocket**: Connects to `alerts_org_{org_id}` channel (only their org's alerts)
- **Restricted**: Cannot see other organizations' data

### Anonymous Reporters
- **Can see**: Only public reports (no organization assignment)
- **Remain anonymous**: No user account, no organization association
- **No access**: Cannot view private dashboards

## Implementation Details

### Database Level

**Model Changes:**
- `CrimeReportBook.assigned_organization` (ForeignKey to `SecurityOrgWhitelist`)
- Auto-assignment: When a user is assigned to a report, their organization is auto-assigned

**Query Filtering:**
```python
from .org_access import get_org_filter, filter_queryset_by_org

# SuperAdmin: Q() (no filter)
# Security Org User: Q(assigned_organization=user_org)
# Others: Q(pk__in=[]) (empty)
```

### API Level

**All Endpoints Filter by Organization:**
- `CrimeReportBookViewset.get_queryset()` - Filters reports
- `SecurityStatsView` - Filters stats by org
- `OrgPerformanceView` - Shows only user's org (or all for SuperAdmin)
- `AnalyticsView` - Filters analytics data by org
- `GlobalStatsView` - SuperAdmin only

**Access Checks:**
```python
from .org_access import can_access_report

# Before retrieving/updating a report
if not can_access_report(request.user, report):
    raise PermissionDenied('You do not have access to this report')
```

### WebSocket Level

**Channels:**
- `alerts_all` - SuperAdmin only (all alerts)
- `alerts_org_{org_id}` - Organization-specific (only that org's alerts)

**Routing:**
- Security Org Users connect to their org's channel
- SuperAdmin connects to `alerts_all`
- Alerts are sent to the correct channel based on report's `assigned_organization`

**Consumer Security:**
- `OrgAlertConsumer` verifies user belongs to requested org
- `AlertConsumer` only allows SuperAdmin

### Analytics Level

**All Analytics Filter by Organization:**
- False Detection Model: Only analyzes user's org reports
- Hotspot Prediction: Only shows hotspots for user's org
- Monetization Model: Only shows user's org metrics (or all for SuperAdmin)
- Performance Metrics: Scoped to user's organization

### Frontend Level

**WebSocket Connection:**
- Security Org Users: `/ws/alerts/{org_id}/`
- SuperAdmin: `/ws/alerts/` (all alerts)

**API Calls:**
- All API calls automatically filtered by backend
- Frontend receives only authorized data

## Security Guarantees

1. **No Cross-Organization Data Leakage**:
   - Database queries always filter by organization
   - API endpoints enforce organization boundaries
   - WebSocket channels are organization-specific
   - Analytics are scoped to organization

2. **SuperAdmin Override**:
   - SuperAdmin bypasses all filters
   - Can see all organizations' data
   - Required for system administration

3. **Anonymous Reporters Protected**:
   - Anonymous reports have no `assigned_organization`
   - Only SuperAdmin can see unassigned reports
   - Security Org Users only see their assigned reports

## Migration

Run the migration to add the `assigned_organization` field:

```bash
cd core
source venv/bin/activate
python manage.py migrate nawaapp
```

## Testing

### Test Cases

1. **Security Org User A** should only see reports assigned to Org A
2. **Security Org User B** should only see reports assigned to Org B
3. **SuperAdmin** should see all reports
4. **WebSocket alerts** should only go to the correct organization
5. **Analytics** should be scoped to organization
6. **API endpoints** should return 403 for unauthorized access

### Manual Testing

1. Create two Security Org Users in different organizations
2. Assign reports to each organization
3. Login as User A - should only see Org A reports
4. Login as User B - should only see Org B reports
5. Login as SuperAdmin - should see all reports
6. Test WebSocket - each user should only receive their org's alerts

## Files Modified

### Backend
- `core/nawaapp/models.py` - Added `assigned_organization` field
- `core/nawaapp/org_access.py` - New utility module
- `core/nawaapp/views.py` - Updated all views to filter by org
- `core/nawaapp/consumers.py` - Updated WebSocket consumers
- `core/nawaapp/websocket_utils.py` - Updated alert routing
- `core/nawaapp/migrations/0018_*.py` - Migration for new field

### Frontend
- `frontend/src/pages/SecurityDashboardPage.tsx` - Updated WebSocket connection
- `frontend/src/api/auth.ts` - Updated to include organization info

## Notes

- Reports without `assigned_organization` are only visible to SuperAdmin
- When a user is assigned to a report, their organization is auto-assigned
- Organization assignment can be manually changed by SuperAdmin
- All filtering happens at the database/API level - frontend cannot bypass

