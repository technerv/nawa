# NAWA Login Access Guide

## Overview

NAWA uses a 3-user model:
1. **Anonymous Reporter** - No login required (public reporting)
2. **Security Org User** - Login required (responders)
3. **Super Admin** - Login required (system administrators)

## How to Access Dashboards

### 1. Super Admin Dashboard

**Access:**
- Navigate to: `/login` (or click "Login" in the header)
- Enter SuperAdmin credentials
- After login, you'll be redirected to `/dashboard`
- The system automatically routes SuperAdmins to the Super Admin Dashboard

**Creating a SuperAdmin Account:**

**Option A: Via Django Admin (Recommended)**
```bash
# 1. Create a superuser via Django management command
cd core
python manage.py createsuperuser

# 2. Assign SuperAdmin role
# - Go to Django Admin: http://127.0.0.1:8000/admin/
# - Navigate to Users → Select your user
# - In "Groups" section, add "SuperAdmin" group
# - Save
```

**Option B: Via Python Shell**
```python
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group

User = get_user_model()
user = User.objects.create_user(username='superadmin', password='your_password')
superadmin_group, _ = Group.objects.get_or_create(name='SuperAdmin')
user.groups.add(superadmin_group)
user.is_staff = True
user.is_superuser = True
user.save()
```

**Option C: Via App (if you already have a SuperAdmin)**
- Login as existing SuperAdmin
- Go to `/admin/users`
- Click "+ Create User"
- Fill in the form (this creates Security Org Users by default)
- To create another SuperAdmin, you'll need to use Django Admin to change the role

### 2. Security Dashboard (Security Org Users)

**Access:**
- Navigate to: `/login`
- Enter Security Org User credentials
- After login, you'll be redirected to `/dashboard`
- The system automatically routes Security Org Users to the Security Dashboard

**Creating Security Org User Accounts:**

**Via SuperAdmin in App:**
1. Login as SuperAdmin
2. Navigate to `/admin/users`
3. Click "+ Create User"
4. Fill in the form:
   - Username, Password, Email
   - Organization Name (required)
   - Organization Type (Police, County Command, Private Security, etc.)
   - Contact information
   - IP/VPN restrictions (optional)
5. Click "Create User"
6. The user account and whitelist entry are created automatically

**Via Django Admin:**
1. Login to Django Admin as SuperAdmin
2. Go to Users → Add User
3. Create user account
4. Assign "SecurityOrgUser" group
5. Go to Security Org Whitelists → Add
6. Link the user and fill in organization details

## Dashboard Routing

The system automatically routes users based on their role:

- **SuperAdmin** → `/dashboard` → Super Admin Dashboard
- **SecurityOrgUser** → `/dashboard` → Security Dashboard  
- **Other roles** → `/dashboard` → Default Dashboard (legacy)

## Testing Login

### Quick Test Setup

1. **Create SuperAdmin:**
```bash
cd core
python manage.py createsuperuser
# Username: admin
# Email: admin@nawa.local
# Password: admin123
```

2. **Assign SuperAdmin Role:**
   - Go to Django Admin
   - Users → Select "admin"
   - Add to "SuperAdmin" group
   - Save

3. **Login:**
   - Go to `/login`
   - Username: `admin`
   - Password: `admin123`
   - You'll see "Logged in as admin (SuperAdmin)"
   - Redirected to Super Admin Dashboard

4. **Create Security Org User:**
   - While logged in as SuperAdmin
   - Go to `/admin/users`
   - Click "+ Create User"
   - Create a test Security Org User
   - Logout and login with new credentials
   - You'll be redirected to Security Dashboard

## Troubleshooting

**Issue: "Access denied" or redirected to wrong dashboard**
- Check user's groups in Django Admin
- Ensure "SuperAdmin" or "SecurityOrgUser" group is assigned
- Clear browser localStorage: `localStorage.clear()` in browser console

**Issue: Can't login**
- Verify user exists in Django Admin
- Check password is correct
- Ensure user is not blocked in SecurityOrgWhitelist (if Security Org User)

**Issue: Security Org User can't access dashboard**
- Verify user has "SecurityOrgUser" group
- Check SecurityOrgWhitelist entry exists and `is_active=True`
- Verify IP restrictions (if configured) allow your IP

## URLs

- **Login:** `/login`
- **Super Admin Dashboard:** `/dashboard` (auto-routed for SuperAdmin)
- **Security Dashboard:** `/dashboard` (auto-routed for SecurityOrgUser)
- **User Management:** `/admin/users` (SuperAdmin only)
- **Triage Configuration:** `/admin/triage` (SuperAdmin only)

