# Testing SMS Functionality

This guide explains how to test SMS sending in the Neighbourhood Alert Watch App.

## Prerequisites

1. **Choose an SMS Provider:**
   - **Africa's Talking** (Recommended for Kenya) - https://africastalking.com
   - **Twilio** (International) - https://www.twilio.com

2. **Install Required Packages:**
   ```bash
   # For Africa's Talking (optional - HTTP fallback works without it)
   pip install africastalking
   
   # For Twilio
   pip install twilio
   ```

## Configuration

### Option 1: Africa's Talking (Kenya)

1. Sign up at https://africastalking.com
2. Get your API key and username from the dashboard
3. Add to your `.env` file:
   ```bash
   AFRICAS_TALKING_API_KEY=your-api-key-here
   AFRICAS_TALKING_USERNAME=sandbox  # or your production username
   AFRICAS_TALKING_SHORTCODE=  # Optional: your shortcode
   ```

### Option 2: Twilio

1. Sign up at https://www.twilio.com
2. Get your Account SID, Auth Token, and a phone number
3. Add to your `.env` file:
   ```bash
   TWILIO_ACCOUNT_SID=your-account-sid
   TWILIO_AUTH_TOKEN=your-auth-token
   TWILIO_FROM_NUMBER=+1234567890  # Your Twilio phone number
   ```

## Testing Methods

### Method 1: Using the Test Command (Recommended)

Test SMS directly from the command line:

```bash
# Test with a phone number
python manage.py test_sms --phone +254712345678 --message "Test message from NAWA"

# Test with a user (uses phone from UserProfile)
python manage.py test_sms --user myusername --message "Test alert"
```

### Method 2: Test via Creating a Crime Report

1. **Set up a test user:**
   - Go to Django Admin → Users → Create/Edit a user
   - Go to User Profiles → Create/Edit profile for the user
   - Add a phone number (e.g., `+254712345678` or `0712345678`)
   - Set `on_duty = True` if the user is a FieldOfficer

2. **Create an Alert Subscription:**
   - Go to Django Admin → Alert Subscriptions
   - Create a new subscription:
     - User: Select your test user
     - Channel: SMS
     - County: (optional, leave blank for all counties)
     - Enabled: ✓
     - Quiet Hours: (optional, leave blank for no quiet hours)

3. **Assign user to a role:**
   - Go to Django Admin → Users → Select user → Groups
   - Add user to one of: Dispatcher, FieldOfficer, Admin, or SuperAdmin

4. **Create a crime report:**
   - Log in to the frontend
   - Go to Reports page
   - Create a new crime report
   - SMS will be sent automatically to users who:
     - Are in the correct role (Dispatcher, FieldOfficer, Admin, SuperAdmin)
     - Have SMS subscription enabled
     - Are in the same county (if county is specified)
     - Are on duty (if FieldOfficer)

### Method 3: Test via Django Shell

```python
python manage.py shell

from nawaapp.channels import get_sms_provider
from nawaapp.models import CrimeReportBook

# Get SMS provider
sms = get_sms_provider()
print(f"SMS Provider enabled: {sms.enabled}")

# Send test SMS
success = sms.send("+254712345678", "Test message from NAWA")
print(f"SMS sent: {success}")

# Test with a real incident
incident = CrimeReportBook.objects.first()
if incident:
    from nawaapp.alerting import create_alert_event
    event = create_alert_event(incident, 'created', 'Test alert')
    print(f"Alert event created: {event.id}")
```

## Troubleshooting

### SMS Not Sending

1. **Check Configuration:**
   ```bash
   python manage.py shell -c "from nawaapp.channels import get_sms_provider; p = get_sms_provider(); print(f'Enabled: {p.enabled}')"
   ```

2. **Check Logs:**
   - Look for SMS-related log messages in your Django console
   - Check for errors like "Failed to send SMS"

3. **Verify Phone Number Format:**
   - Kenya: `+254712345678` or `0712345678` (will be auto-converted)
   - International: `+[country code][number]`

4. **Check User Profile:**
   - Ensure user has `phone_number` set in UserProfile
   - Ensure `sms_opt_in = True`

5. **Check Alert Subscription:**
   - Ensure subscription exists and is enabled
   - Check county filter matches (if set)
   - Check quiet hours (SMS won't send during quiet hours)

### Africa's Talking Issues

- **Sandbox Mode:** In sandbox, you can only send to verified numbers
- **Production:** Requires approval and may have costs
- **HTTP Fallback:** Works without SDK, but SDK is recommended

### Twilio Issues

- **Trial Account:** Can only send to verified numbers
- **Phone Number:** Must use a Twilio phone number as `from`
- **Format:** Phone numbers must include country code

## Testing Checklist

- [ ] SMS provider configured in `.env`
- [ ] Required packages installed (`africastalking` or `twilio`)
- [ ] Test command works: `python manage.py test_sms --phone +254712345678`
- [ ] User has phone number in UserProfile
- [ ] User has SMS AlertSubscription enabled
- [ ] User is assigned to appropriate role group
- [ ] Created a test crime report
- [ ] Checked AlertEvent in Django Admin for dispatch results
- [ ] Received SMS on test phone

## Viewing Alert Results

After creating a crime report, check the alert results:

1. Go to Django Admin → Alert Events
2. Find the most recent event
3. Check the "Dispatch Summary" field to see which channels succeeded/failed
4. The `payload` field contains detailed dispatch results per user

